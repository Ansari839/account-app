-- CreateTable
CREATE TABLE "VoucherSequence" (
    "id" TEXT NOT NULL,
    "type" "VoucherType" NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoucherSequence_type_key" ON "VoucherSequence"("type");
