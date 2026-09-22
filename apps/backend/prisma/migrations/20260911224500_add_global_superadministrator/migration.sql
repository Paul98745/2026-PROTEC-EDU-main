ALTER TABLE "users"
    ADD COLUMN "isSuperAdministrator" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "users_isSuperAdministrator_idx" ON "users"("isSuperAdministrator");
