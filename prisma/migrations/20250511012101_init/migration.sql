-- CreateEnum
CREATE TYPE "AuditLogType" AS ENUM ('build', 'publish');

-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('working', 'inactive', 'activePreview', 'activeProduction');

-- CreateTable
CREATE TABLE "Build"
(
    "id"        SERIAL        NOT NULL,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user"      TEXT          NOT NULL,
    "message"   TEXT          NOT NULL,
    "status"    "BuildStatus" NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog"
(
    "id"     SERIAL         NOT NULL,
    "time"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type"   "AuditLogType" NOT NULL,
    "user"   TEXT           NOT NULL,
    "values" TEXT[],

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
