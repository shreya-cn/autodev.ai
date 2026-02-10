import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    // Since we now read documentation files directly on each query,
    // reindexing just validates that documentation exists
    const workspaceRoot = process.cwd().replace('/autodev-ui', '');
    let docCount = 0;
    
    try {
      const services = ['identityprovider', 'enrollment', 'usermanagement', 'vehiclemanagement'];
      
      for (const service of services) {
        const docPath = path.join(workspaceRoot, service, 'documentation');
        if (fs.existsSync(docPath)) {
          const files = fs.readdirSync(docPath);
          docCount += files.filter(f => f.endsWith('.adoc')).length;
        }
      }

      // Count README files
      if (fs.existsSync(path.join(workspaceRoot, 'README.md'))) {
        docCount++;
      }
      if (fs.existsSync(path.join(workspaceRoot, 'PROJECT_OVERVIEW.md'))) {
        docCount++;
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to scan documentation files' },
        { status: 500 }
      );
    }

    if (docCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'No documentation files found. Please generate documentation first.',
        documentsIndexed: 0
      });
    }

    return NextResponse.json({
      success: true,
      message: `Knowledge base ready! Found ${docCount} documentation file(s).`,
      documentsIndexed: docCount
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to rebuild knowledge base'
      },
      { status: 500 }
    );
  }
}
