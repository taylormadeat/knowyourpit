import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const ctrl = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  insertCount: 0,
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@workspace/db")>();

  function selectBuilder(rows: unknown[]) {
    const builder: any = {
      from: () => builder,
      where: () => Promise.resolve(rows),
    };
    return builder;
  }

  const db = {
    select: () => selectBuilder(ctrl.selectResults.shift() ?? []),
    insert: () => {
      ctrl.insertCount += 1;
      const builder: any = {
        values: () => builder,
        onConflictDoNothing: () => builder,
        returning: () => Promise.resolve([]),
      };
      return builder;
    },
  };

  return { ...original, db };
});

vi.mock("../../middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "checkin-idempotency-test-user";
    next();
  },
}));

import cookCheckinsRouter from "../cookCheckins";

describe("cook check-in idempotency", () => {
  beforeEach(() => {
    ctrl.insertCount = 0;
    ctrl.selectResults = [];
  });

  it("returns the existing row when the client operation was already committed", async () => {
    const existing = {
      id: 91,
      cookId: 42,
      scheduledAt: "2030-07-04T12:00:00.000Z",
      firedAt: "2030-07-04T12:00:01.000Z",
      internalTempF: 155,
      pitTempF: 250,
      statusFlag: null,
      userNote: null,
      photoKey: null,
      aiGuidanceShown: null,
      autoDismissed: false,
      isAutomatic: false,
      probeSource: null,
      phaseLabel: "Manual",
      phaseKey: "manual",
      clientOperationId: "local-checkin-123",
      createdAt: "2030-07-04T12:00:01.000Z",
      updatedAt: "2030-07-04T12:00:01.000Z",
    };
    ctrl.selectResults = [
      [{ id: 42 }],
      [existing],
    ];
    const app = express();
    app.use(express.json());
    app.use("/api", cookCheckinsRouter);

    const response = await request(app)
      .post("/api/cooks/42/checkins")
      .send({
        scheduledAt: existing.scheduledAt,
        internalTempF: 155,
        pitTempF: 250,
        phaseLabel: "Manual",
        phaseKey: "manual",
        clientOperationId: existing.clientOperationId,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 91,
      cookId: 42,
      clientOperationId: "local-checkin-123",
    });
    expect(ctrl.insertCount).toBe(1);
    expect(ctrl.selectResults).toHaveLength(0);
  });
});