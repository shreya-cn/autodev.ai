import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // TODO: Implement GitHub API integration
    // For now, return mock data
    
    return NextResponse.json({
      comments: [
        {
          id: '1',
          prNumber: 42,
          prTitle: 'KAN-4: Task management improvements',
          comment: 'Great work! Could you add unit tests for the new functionality?',
          author: 'reviewer1',
          createdAt: new Date().toISOString(),
          url: 'https://github.com/example/repo/pull/42',
        },
        {
          id: '2',
          prNumber: 42,
          prTitle: 'KAN-4: Task management improvements',
          comment: 'Please address the linting errors in the CI pipeline',
          author: 'reviewer2',
          createdAt: new Date().toISOString(),
          url: 'https://github.com/example/repo/pull/42',
        },
      ],
    });
  } catch (error) {
    console.error('Error fetching PR comments:', error);
    return NextResponse.json({ comments: [] });
  }
}
