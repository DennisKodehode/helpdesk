-- Enforce the global admin as a true singleton: at most one non-deleted user
-- may hold the `globalAdmin` role. This is a partial unique index (Prisma can't
-- express it in the schema), so it lives as hand-written SQL. The `globalAdmin`
-- enum value was added in a prior migration, so it is safely committed before
-- this index references it.
CREATE UNIQUE INDEX "one_global_admin"
  ON "user" ("role")
  WHERE "role" = 'globalAdmin' AND "deletedAt" IS NULL;
