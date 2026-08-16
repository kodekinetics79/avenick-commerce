import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@avenick/database", () => ({
  db: { category: { findMany: mocks.findMany } },
}));

import { GET } from "./route";

describe("customer category navigation", () => {
  beforeEach(() => mocks.findMany.mockReset());

  it("requests only public-active populated parent and child categories", async () => {
    mocks.findMany.mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isActive: true,
        parentId: null,
        OR: expect.arrayContaining([
          expect.objectContaining({ products: { some: { status: "ACTIVE", deletedAt: null, isPubliclyDiscoverable: true } } }),
          expect.objectContaining({ children: { some: expect.objectContaining({ isActive: true }) } }),
        ]),
      }),
      include: {
        children: {
          where: {
            isActive: true,
            products: { some: { status: "ACTIVE", deletedAt: null, isPubliclyDiscoverable: true } },
          },
        },
      },
    }));
  });
});
