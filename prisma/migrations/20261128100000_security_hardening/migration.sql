-- Sign-ins made before a password change (or removal / role change) stop working.
ALTER TABLE "Staff" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Attempt counters shared by every server instance (sign-in, guest orders, AI scans).
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
