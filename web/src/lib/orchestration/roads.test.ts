// Run: node --test src/lib/orchestration/roads.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRoutesBody, decodePolyline, durationSeconds, nodesFromKey, routeKey, toRoadRoute } from "./roads.ts";

test("decodes Google's encoded polyline (the documented example)", () => {
    assert.deepEqual(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@"), [
        { lat: 38.5, lng: -120.2 },
        { lat: 40.7, lng: -120.95 },
        { lat: 43.252, lng: -126.453 },
    ]);
    assert.deepEqual(decodePolyline(""), []);
});

test("request body: first node is the origin, last the destination, the rest are stops in order", () => {
    const body = computeRoutesBody([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }, { lat: 1, lng: 2 }]);
    assert.deepEqual(body.origin, { location: { latLng: { latitude: 1, longitude: 2 } } });
    assert.deepEqual(body.destination, { location: { latLng: { latitude: 1, longitude: 2 } } });
    assert.deepEqual(body.intermediates.map((w) => w.location.latLng.latitude), [3, 5]);
    assert.equal(body.travelMode, "DRIVE");
});

test("response: road km and drive minutes per leg and in total; no route means undefined", () => {
    const route = toRoadRoute({
        routes: [
            {
                distanceMeters: 12400,
                duration: "1500s",
                legs: [
                    { distanceMeters: 7400, duration: "900s", polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC" } },
                    { distanceMeters: 5000, duration: "600s" },
                ],
            },
        ],
    });
    assert.deepEqual(route?.legs.map((l) => [l.km, l.minutes, l.path.length]), [[7.4, 15, 2], [5, 10, 0]]);
    assert.deepEqual([route?.km, route?.minutes], [12.4, 25]);
    assert.equal(toRoadRoute({ routes: [] }), undefined);
    assert.equal(toRoadRoute({}), undefined);
    assert.equal(durationSeconds(undefined), 0);
});

test("cache key round-trips a node sequence", () => {
    const nodes = [{ lat: 21.25, lng: 77.5 }, { lat: 21.2234567, lng: 77.4712345 }];
    assert.deepEqual(nodesFromKey(routeKey(nodes)), [{ lat: 21.25, lng: 77.5 }, { lat: 21.22346, lng: 77.47123 }]);
    assert.deepEqual(nodesFromKey(""), []);
});
