import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('1234', 10);

  const users = [
    {
      username: 'banker',
      displayName: 'Banker (Admin)',
      passwordHash,
      role: Role.ADMIN,
      avatarIndex: 0,
    },
    {
      username: 'player1',
      displayName: 'Player 1',
      passwordHash,
      role: Role.PLAYER,
      avatarIndex: 1,
      coin: 100,
    },
    {
      username: 'player3',
      displayName: 'Player 3',
      passwordHash,
      role: Role.PLAYER,
      avatarIndex: 3,
      coin: 100,
    },
    {
      username: 'player4',
      displayName: 'Player 4',
      passwordHash,
      role: Role.PLAYER,
      avatarIndex: 4,
      coin: 100,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: user,
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
