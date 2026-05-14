const axios = require("axios");
const { getRedisClient } = require("./notificationCache");

const VALHALLA_HOST = process.env.VALHALLA_HOST || "85.195.73.163";
const VALHALLA_PORT = parseInt(process.env.VALHALLA_PORT || "9002");

const ROAD_SPEED_CACHE_TTL = 60 * 60 * 24;
const COORD_PRECISION = 4; // ~11 metres

function roundCoord(val) {
  return parseFloat(val.toFixed(COORD_PRECISION));
}

function roadSpeedCacheKey(lat, lng) {
  return "roadspeed:" + roundCoord(lat) + ":" + roundCoord(lng);
}

async function valhallaPost(path, payload) {
  try {
    const response = await axios.post(
      `http://${VALHALLA_HOST}:${VALHALLA_PORT}${path}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );

    return response.data;
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Valhalla ${err.response.status}: ${
          err.response.data?.error || JSON.stringify(err.response.data)
        }`
      );
    }

    if (err.code === "ECONNABORTED") {
      throw new Error("Valhalla request timed out");
    }

    throw new Error(`Valhalla request error: ${err.message}`);
  }
}
// Road class priority — higher index = higher priority road
// If multiple edges come back (e.g. at an intersection), we pick the most significant road
const ROAD_CLASS_PRIORITY = [
  "service_other",    // 0 - lowest
  "track",
  "path",
  "residential",
  "unclassified",
  "tertiary",
  "secondary",
  "primary",
  "trunk",
  "motorway",         // 9 - highest
];

function roadClassRank(roadClass) {
  var idx = ROAD_CLASS_PRIORITY.indexOf(roadClass);
  return idx === -1 ? 0 : idx;
}

async function fetchRoadSpeedFromValhalla(lat, lng) {
  // Offset second point ~10 metres north so Valhalla has a real segment to snap
  const offsetLat = lat + 0.00009;

  const payload = {
    shape: [
      { lat: lat, lon: lng, type: "break" },
      { lat: offsetLat, lon: lng, type: "break" },
    ],
    costing: "auto",
    shape_match: "map_snap",
    filters: {
      attributes: [
        "edge.speed",
        "edge.speed_limit",
        "edge.road_class",
        "edge.names",
      ],
      action: "include",
    },
  };

  const response = await valhallaPost("/trace_attributes", payload);
  const edges = response.edges || [];

  if (!edges.length) {
    throw new Error("Valhalla returned no edges for coordinates " + lat + "," + lng);
  }

  // ── Single edge
  if (edges.length === 1) {
    const e = edges[0];
    return {
      speedLimit: (e.speed_limit != null && e.speed_limit !== 0) ? e.speed_limit : null,
      routingSpeed: e.speed || null,
      roadClass: e.road_class || null,
      roadName: (e.names && e.names[0]) || null,
      ambiguous: false,
      edgeCount: 1,
      source: "valhalla",
    };
  }

  // ── Multiple edges
  // Strategy:
  //  1. Pick the edge with the highest road class (most significant road).
  //  2. If two or more edges share the top rank AND have different speed limits,
  //     the result is ambiguous — return ambiguous:true so the caller can skip
  //     the notification rather than risk a false alert.
  console.log("[Valhalla] " + edges.length + " edges returned for " + lat + "," + lng + " — selecting best match");

  // Sort descending by road class rank
  const sorted = edges.slice().sort(function(a, b) {
    return roadClassRank(b.road_class) - roadClassRank(a.road_class);
  });

  const topRank = roadClassRank(sorted[0].road_class);

  // all edges that share the top rank
  const topEdges = sorted.filter(function(edge) {
    return roadClassRank(edge.road_class) === topRank;
  });

  // Check if their speed limits conflict
  const speedLimits = topEdges
    .map(function(edge) {
      return (edge.speed_limit != null && edge.speed_limit !== 0) ? edge.speed_limit : null;
    })
    .filter(function(s) { return s !== null; });

  console.log({speedLimits})

  const uniqueSpeedLimits = speedLimits.filter(function(val, idx, arr) {
    return arr.indexOf(val) === idx;
  });

  if (topEdges.length > 1 && uniqueSpeedLimits.length > 1) {
    // Conflicting speed limits on roads of equal importance — too risky to pick one
    console.warn(
      "[Valhalla] Ambiguous: " + topEdges.length + " top-rank edges with conflicting speed limits " +
      JSON.stringify(uniqueSpeedLimits) + " at " + lat + "," + lng
    );
    return {
      speedLimit: null,
      routingSpeed: null,
      roadClass: sorted[0].road_class || null,
      roadName: null,
      ambiguous: true,
      edgeCount: edges.length,
      source: "valhalla",
    };
  }

  // Top rank edges agree (or only one has a speed limit) — safe to use
  const best = topEdges[0];
  return {
    speedLimit: (best.speed_limit != null && best.speed_limit !== 0) ? best.speed_limit : null,
    routingSpeed: best.speed || null,
    roadClass: best.road_class || null,
    roadName: (best.names && best.names[0]) || null,
    ambiguous: false,
    edgeCount: edges.length,
    source: "valhalla",
  };
}

async function getRoadSpeed(lat, lng) {
  const cacheKey = roadSpeedCacheKey(lat, lng);

  // Cache check
  try {
    const client = await getRedisClient();
    const cached = await client.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      parsed.fromCache = true;
      return parsed;
    }
  } catch (cacheErr) {
    console.warn("[Valhalla] Redis cache read failed:", cacheErr.message);
  }

  // Fetch from Valhalla
  let result;
  try {
    result = await fetchRoadSpeedFromValhalla(lat, lng);
  } catch (valhallaErr) {
    console.error("[Valhalla] Failed to fetch road speed:", valhallaErr.message);
    // Return null gracefully — caller decides how to handle missing road speed
    return {
      speedLimit: null,
      routingSpeed: null,
      roadClass: null,
      roadName: null,
      fromCache: false,
      error: valhallaErr.message,
    };
  }

  //store result in cache
  try {
    var client2 = await getRedisClient();
    client2.setEx(cacheKey, ROAD_SPEED_CACHE_TTL, JSON.stringify(result)).catch(function(e) {
      console.warn("[Valhalla] Cache write failed:", e.message);
    });
  } catch (e) {
  }

  result.fromCache = false;
  return result;
}

module.exports = {
  getRoadSpeed: getRoadSpeed,
  fetchRoadSpeedFromValhalla: fetchRoadSpeedFromValhalla,
};