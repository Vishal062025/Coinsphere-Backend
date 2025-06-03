-- CreateTable
CREATE TABLE "Token" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "token" DOUBLE PRECISION NOT NULL,
    "ercHash" TEXT NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_paymentId_key" ON "Token"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_ercHash_key" ON "Token"("ercHash");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
