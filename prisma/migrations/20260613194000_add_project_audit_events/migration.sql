CREATE TABLE "ProjectAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT,
    "artifactPath" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProjectAuditEvent_projectId_createdAt_idx" ON "ProjectAuditEvent"("projectId", "createdAt");
CREATE INDEX "ProjectAuditEvent_projectId_phase_step_idx" ON "ProjectAuditEvent"("projectId", "phase", "step");
