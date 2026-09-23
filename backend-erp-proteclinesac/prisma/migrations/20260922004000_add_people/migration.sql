-- CreateEnum
CREATE TYPE "PersonProfile" AS ENUM ('COLABORADOR', 'DOCENTE', 'ALUMNO');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "membershipId" UUID,
    "profile" "PersonProfile" NOT NULL,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVO',
    "activatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstName" VARCHAR(100) NOT NULL,
    "middleName" VARCHAR(100),
    "lastName" VARCHAR(100) NOT NULL,
    "secondLastName" VARCHAR(100),
    "gender" VARCHAR(50),
    "maritalStatus" VARCHAR(50),
    "documentType" VARCHAR(20) NOT NULL,
    "documentNumber" VARCHAR(20) NOT NULL,
    "personalEmail" VARCHAR(254),
    "institutionalEmail" VARCHAR(254),
    "phone" VARCHAR(30),
    "referencePhone" VARCHAR(30),
    "country" VARCHAR(100),
    "city" VARCHAR(100),
    "district" VARCHAR(100),
    "address" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_relatives" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "relationship" VARCHAR(10) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "gender" VARCHAR(50),
    "documentNumber" VARCHAR(20) NOT NULL,

    CONSTRAINT "person_relatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_documents" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "relativeId" UUID,
    "kind" VARCHAR(30) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "people_membershipId_key" ON "people"("membershipId");

-- CreateIndex
CREATE INDEX "people_institutionId_profile_status_idx" ON "people"("institutionId", "profile", "status");

-- CreateIndex
CREATE UNIQUE INDEX "people_institutionId_documentType_documentNumber_key" ON "people"("institutionId", "documentType", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "people_membershipId_institutionId_key" ON "people"("membershipId", "institutionId");

-- CreateIndex
CREATE INDEX "person_relatives_personId_idx" ON "person_relatives"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "person_relatives_id_personId_key" ON "person_relatives"("id", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "person_documents_storageKey_key" ON "person_documents"("storageKey");

-- CreateIndex
CREATE INDEX "person_documents_personId_idx" ON "person_documents"("personId");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "institution_memberships"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_relatives" ADD CONSTRAINT "person_relatives_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_relativeId_personId_fkey" FOREIGN KEY ("relativeId", "personId") REFERENCES "person_relatives"("id", "personId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "people" ADD CONSTRAINT "people_document_type_check" CHECK ("documentType" IN ('DNI', 'CE', 'PASAPORTE', 'RUC'));
ALTER TABLE "person_relatives" ADD CONSTRAINT "person_relatives_relationship_check" CHECK ("relationship" IN ('PADRE', 'MADRE', 'HIJO'));
CREATE UNIQUE INDEX "person_relatives_one_parent" ON "person_relatives" ("personId", "relationship") WHERE "relationship" IN ('PADRE', 'MADRE');
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_size_check" CHECK ("size" > 0 AND "size" <= 5242880);
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_child_check" CHECK (("kind" = 'DOCUMENTO_HIJO') = ("relativeId" IS NOT NULL));

-- Grant the new module to existing administrator roles without resetting accounts.
INSERT INTO "permissions" ("id", "resource", "action", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'people', action, NOW(), NOW()
FROM (VALUES ('view'), ('create'), ('edit')) AS actions(action)
ON CONFLICT ("resource", "action") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId", "assignedAt")
SELECT r."id", p."id", NOW() FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" IN ('SUPERADMINISTRADOR', 'ADMINISTRADOR') AND p."resource" = 'people'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
