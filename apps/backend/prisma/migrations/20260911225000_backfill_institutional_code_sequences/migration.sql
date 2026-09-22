INSERT INTO "institutional_code_sequences" (
    "id", "institutionId", "academicYear", "period", "lastValue", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    membership."institutionId",
    2000 + substring(membership."studentCode" FROM 2 FOR 3)::integer,
    substring(membership."studentCode" FROM 5 FOR 1)::integer,
    MAX(substring(membership."studentCode" FROM 6)::integer),
    NOW(),
    NOW()
FROM "institution_memberships" AS membership
WHERE membership."studentCode" ~ '^[A-Z][0-9]{3}[1-9][0-9]{5,}$'
GROUP BY
    membership."institutionId",
    substring(membership."studentCode" FROM 2 FOR 3),
    substring(membership."studentCode" FROM 5 FOR 1)
ON CONFLICT ("institutionId", "academicYear", "period")
DO UPDATE SET
    "lastValue" = GREATEST(
        "institutional_code_sequences"."lastValue",
        EXCLUDED."lastValue"
    ),
    "updatedAt" = NOW();
