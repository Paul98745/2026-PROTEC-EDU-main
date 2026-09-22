ALTER TABLE "institutions" ADD COLUMN "codePrefix" CHAR(1);

UPDATE "institutions"
SET "codePrefix" = upper(left("code", 1));

ALTER TABLE "institutions"
    ALTER COLUMN "codePrefix" SET NOT NULL,
    ADD CONSTRAINT "institutions_codePrefix_nonblank_check" CHECK (btrim("codePrefix") <> ''),
    ADD CONSTRAINT "institutions_codePrefix_uppercase_check" CHECK ("codePrefix" = upper("codePrefix"));

CREATE UNIQUE INDEX "institutions_codePrefix_key" ON "institutions"("codePrefix");

CREATE TABLE "institutional_code_sequences" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "institutional_code_sequences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "institutional_code_sequences_period_check" CHECK ("period" BETWEEN 1 AND 9),
    CONSTRAINT "institutional_code_sequences_lastValue_check" CHECK ("lastValue" >= 0)
);

CREATE UNIQUE INDEX "institutional_code_sequences_institutionId_academicYear_period_key"
    ON "institutional_code_sequences"("institutionId", "academicYear", "period");

ALTER TABLE "institutional_code_sequences"
    ADD CONSTRAINT "institutional_code_sequences_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH ranked AS (
    SELECT id, "institutionId", row_number() OVER (PARTITION BY "institutionId" ORDER BY "createdAt", id) AS sequence
    FROM "institution_memberships"
    WHERE "studentCode" IS NOT NULL
)
UPDATE "institution_memberships" membership
SET "studentCode" = institution."codePrefix" || '0261' || lpad(ranked.sequence::text, 5, '0')
FROM ranked
JOIN "institutions" institution ON institution.id = ranked."institutionId"
WHERE membership.id = ranked.id;

ALTER TABLE "institution_memberships"
    ADD CONSTRAINT "institution_memberships_studentCode_format_check"
    CHECK ("studentCode" IS NULL OR "studentCode" ~ '^[A-Z][0-9]{3}[1-9][0-9]{5,}$');
