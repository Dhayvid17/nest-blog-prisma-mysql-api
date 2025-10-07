import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Clean the database first
  await prisma.post.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Create 10 users
  const users = await Promise.all(
    [
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'Test123!@#',
        bio: 'Software engineer with 5 years of experience',
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        password: 'Pass123!@#',
        bio: 'UI/UX designer and frontend developer',
      },
      {
        name: 'Mike Johnson',
        email: 'mike.j@example.com',
        password: 'Secure123!@#',
        bio: 'DevOps engineer and cloud architect',
      },
      {
        name: 'Sarah Wilson',
        email: 'sarah.w@example.com',
        password: 'Sarah123!@#',
        bio: 'Full-stack developer specializing in React and Node.js',
      },
      {
        name: 'David Brown',
        email: 'david.b@example.com',
        password: 'David123!@#',
        bio: 'Mobile app developer and UI designer',
      },
      {
        name: 'Emma Davis',
        email: 'emma.d@example.com',
        password: 'Emma123!@#',
        bio: 'Data scientist and machine learning engineer',
      },
      {
        name: 'Alex Turner',
        email: 'alex.t@example.com',
        password: 'Alex123!@#',
        bio: 'Backend developer focusing on scalable systems',
      },
      {
        name: 'Lisa Anderson',
        email: 'lisa.a@example.com',
        password: 'Lisa123!@#',
        bio: 'QA engineer with automation expertise',
      },
      {
        name: 'Tom Wilson',
        email: 'tom.w@example.com',
        password: 'Tom123!@#',
        bio: 'Security specialist and penetration tester',
      },
      {
        name: 'Maria Garcia',
        email: 'maria.g@example.com',
        password: 'Maria123!@#',
        bio: 'Technical writer and documentation specialist',
      },
    ].map(async (user) => {
      const hashedPassword = await argon2.hash(user.password);
      return prisma.user.create({
        data: {
          ...user,
          password: hashedPassword,
        },
      });
    }),
  );

  // Create 10 categories
  const categories = await Promise.all(
    [
      {
        name: 'Technology',
        description: 'Latest tech news and innovations',
      },
      {
        name: 'Programming',
        description: 'Programming tutorials and best practices',
      },
      {
        name: 'Web Development',
        description: 'Web development techniques and frameworks',
      },
      {
        name: 'Mobile Development',
        description: 'Mobile app development for iOS and Android',
      },
      {
        name: 'DevOps',
        description: 'DevOps practices and tools',
      },
      {
        name: 'Artificial Intelligence',
        description: 'AI and machine learning topics',
      },
      {
        name: 'Cybersecurity',
        description: 'Security best practices and news',
      },
      {
        name: 'Cloud Computing',
        description: 'Cloud platforms and services',
      },
      {
        name: 'Data Science',
        description: 'Data analysis and visualization',
      },
      {
        name: 'Career Growth',
        description: 'Professional development in tech',
      },
    ].map((category) =>
      prisma.category.create({
        data: category,
      }),
    ),
  );

  // Create 10 posts with different combinations of authors and categories
  const posts = await Promise.all(
    [
      {
        title: 'Getting Started with NestJS',
        content:
          'NestJS is a progressive Node.js framework for building efficient and scalable server-side applications...',
        published: true,
        authorId: users[0].id,
        categoryIds: [categories[1].id, categories[2].id],
      },
      {
        title: 'Modern Web Development Practices',
        content:
          'Explore the latest trends and best practices in modern web development...',
        published: true,
        authorId: users[1].id,
        categoryIds: [categories[2].id],
      },
      {
        title: 'Introduction to Docker',
        content: 'Learn the basics of containerization with Docker...',
        published: true,
        authorId: users[2].id,
        categoryIds: [categories[4].id, categories[7].id],
      },
      {
        title: 'React vs Vue: A Comparison',
        content: 'Detailed comparison of React and Vue frameworks...',
        published: false,
        authorId: users[3].id,
        categoryIds: [categories[2].id],
      },
      {
        title: 'Mobile App Design Principles',
        content:
          'Essential principles for designing user-friendly mobile applications...',
        published: true,
        authorId: users[4].id,
        categoryIds: [categories[3].id],
      },
      {
        title: 'Machine Learning Basics',
        content:
          'Introduction to machine learning concepts and applications...',
        published: true,
        authorId: users[5].id,
        categoryIds: [categories[5].id, categories[8].id],
      },
      {
        title: 'Scaling Node.js Applications',
        content: 'Learn how to scale Node.js applications for production...',
        published: false,
        authorId: users[6].id,
        categoryIds: [categories[1].id, categories[7].id],
      },
      {
        title: 'Testing Best Practices',
        content: 'Best practices for testing software applications...',
        published: true,
        authorId: users[7].id,
        categoryIds: [categories[1].id],
      },
      {
        title: 'Cybersecurity Essentials',
        content: 'Essential cybersecurity practices for developers...',
        published: true,
        authorId: users[8].id,
        categoryIds: [categories[6].id],
      },
      {
        title: 'Technical Writing Tips',
        content:
          'Tips for writing clear and effective technical documentation...',
        published: true,
        authorId: users[9].id,
        categoryIds: [categories[9].id],
      },
    ].map((post) =>
      prisma.post.create({
        data: {
          title: post.title,
          content: post.content,
          published: post.published,
          author: {
            connect: { id: post.authorId },
          },
          categories: {
            connect: post.categoryIds.map((id) => ({ id })),
          },
        },
      }),
    ),
  );

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error while seeding the database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
