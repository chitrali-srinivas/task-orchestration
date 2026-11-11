// Run: node --test src/app/layouts/survey-builder/lib/master-data-registry.test.ts   (Node 24 strips types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { MASTER_DEFINITIONS, derivedKeys, migrateMasters } from "./master-data-registry.ts";

test("surveyors become Surveyor users once, keeping their ids and fields", () => {
    const store = {
        villages: [{ id: "v1", villageName: "Rampur" }],
        surveyors: [{ id: "s1", surveyorName: "Asha", phone: "1", baseVillage: "Rampur", baseVillageId: "v1", maxVisitsPerDay: "6", active: "Yes" }],
    };
    const migrated = migrateMasters(store)!;
    assert.deepEqual(migrated.users, [{ id: "s1", name: "Asha", role: "Surveyor", phone: "1", baseVillage: "Rampur", baseVillageId: "v1", maxVisitsPerDay: "6", active: "Yes" }]);
    assert.equal("surveyors" in migrated, false);
    assert.deepEqual(migrated.villages, store.villages);
    assert.equal(migrateMasters(migrated), undefined); // nothing left to move
    assert.equal(migrateMasters({ users: [], surveyors: [] }), undefined); // users already there: left alone
    assert.equal(migrateMasters({}), undefined);
});

test("masters in sidebar order; a ref's id and a location's numbers are filled in by their editor", () => {
    assert.deepEqual(MASTER_DEFINITIONS.map((d) => d.id), ["villages", "users", "fleet", "drivers", "suppliers"]);
    const users = MASTER_DEFINITIONS.find((d) => d.id === "users")!;
    assert.deepEqual(derivedKeys(users.fields), ["homeLat", "homeLng", "baseVillageId"]);
    const drivers = MASTER_DEFINITIONS.find((d) => d.id === "drivers")!;
    assert.deepEqual(derivedKeys(drivers.fields), ["supplierId", "vehicleId"]);
});
