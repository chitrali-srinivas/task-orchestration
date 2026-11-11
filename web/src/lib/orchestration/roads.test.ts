// Run: node --test src/lib/orchestration/roads.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRoutesBody, decodePolyline, durationSeconds, nodesFromKey, routeKey, stopWalks, toRoadRoute, walkMinutes } from "./roads.ts";

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

test("walks: from where the road leg ends to the stop and back to where the next leg starts; none at the base", () => {
    // Distance = gap in "km" along x; base at 0, a farm at 5 that the road passes at 4.6, a stop right on the road at 9.
    const at = (x: number) => ({ lat: 0, lng: x });
    const line = (a: { lng: number }, b: { lng: number }) => Math.abs(a.lng - b.lng);
    const nodes = [at(0), at(5), at(9), at(0)];
    const leg = (from: number, to: number) => ({ km: 1, minutes: 1, path: [at(from), at(to)] });
    const route = { km: 3, minutes: 3, legs: [leg(0, 4.6), leg(4.6, 9), leg(9, 0)] };
    const walks = stopWalks(nodes, route, line, true);
    assert.deepEqual(walks.map((w) => w.node), [1]); // the stop on the road needs no walk
    assert.equal(Math.round(walks[0].km * 10) / 10, 0.8); // 0.4 in, 0.4 back to the bike
    assert.deepEqual(walks[0].path.map((p) => p.lng), [4.6, 5, 4.6]);
    assert.equal(walks[0].minutes, walkMinutes(walks[0].km));
    assert.equal(walkMinutes(0.75), 10); // 4.5 km/h
});
