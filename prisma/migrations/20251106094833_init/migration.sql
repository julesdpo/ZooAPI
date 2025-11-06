-- CreateTable
CREATE TABLE "Keeper" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keeper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enclosure" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "biome" TEXT NOT NULL,
    "area_m2" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER NOT NULL,
    "temperatureTarget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "sex" TEXT,
    "birthDate" TIMESTAMP(3),
    "diet" TEXT,
    "notes" TEXT,
    "enclosureId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "keeperId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "riskLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_KeeperEnclosures" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_KeeperEnclosures_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Keeper_email_key" ON "Keeper"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Enclosure_name_key" ON "Enclosure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_name_key" ON "Animal"("name");

-- CreateIndex
CREATE INDEX "_KeeperEnclosures_B_index" ON "_KeeperEnclosures"("B");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_enclosureId_fkey" FOREIGN KEY ("enclosureId") REFERENCES "Enclosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_keeperId_fkey" FOREIGN KEY ("keeperId") REFERENCES "Keeper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KeeperEnclosures" ADD CONSTRAINT "_KeeperEnclosures_A_fkey" FOREIGN KEY ("A") REFERENCES "Enclosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KeeperEnclosures" ADD CONSTRAINT "_KeeperEnclosures_B_fkey" FOREIGN KEY ("B") REFERENCES "Keeper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
