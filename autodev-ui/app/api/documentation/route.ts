import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DocumentationItem {
  service: string;
  title: string;
  content: string;
  type: string;
  lastModified?: string;
  pageUrl?: string;
}

interface ConfluencePage {
  id: string;
  title: string;
  url: string;
  lastModified?: string;
}

export async function GET() {
  try {
    const workspaceRoot = process.cwd().replace('/autodev-ui', '');
    
    const microservices = [
      'identityprovider',
      'enrollment',
      'usermanagement',
      'vehiclemanagement'
    ];

    const documentation: DocumentationItem[] = [];
    
    // Get Confluence pages
    let confluencePages: ConfluencePage[] = [];
    try {
      const { stdout } = await execAsync(`python3 ${workspaceRoot}/get_confluence_pages.py`);
      confluencePages = JSON.parse(stdout);
    } catch (error) {
      console.error('Error fetching Confluence pages:', error);
    }

    // Read documentation from each microservice
    for (const service of microservices) {
      const docDir = join(workspaceRoot, service, 'documentation');
      
      try {
        const files = await readdir(docDir);
        
        for (const file of files) {
          if (file.endsWith('.adoc') || file.endsWith('.md')) {
            const filePath = join(docDir, file);
            const content = await readFile(filePath, 'utf-8');
            const stats = await readFile(filePath, 'utf-8');
            
            // Extract title from filename
            const title = file
              .replace(/\.(adoc|md)$/, '')
              .split(/(?=[A-Z])/)
              .join(' ')
              .replace(/^./, str => str.toUpperCase());

            // Try to match with Confluence page
            // Confluence pages are titled like "Openapispecification - Usermanagement"
            const fileNameWithoutExt = file.replace(/\.(adoc|md)$/, '');
            const serviceCapitalized = service.charAt(0).toUpperCase() + service.slice(1);
            const expectedPageTitle = `${fileNameWithoutExt.charAt(0).toUpperCase() + fileNameWithoutExt.slice(1)} - ${serviceCapitalized}`;
            
            const matchingPage = confluencePages.find(p => 
              p.title.toLowerCase() === expectedPageTitle.toLowerCase()
            );

            documentation.push({
              service,
              title,
              content: content.substring(0, 500), // Preview only
              type: file.endsWith('.adoc') ? 'asciidoc' : 'markdown',
              lastModified: matchingPage?.lastModified || new Date().toISOString(),
              pageUrl: matchingPage?.url
            });
          }
        }
      } catch (error) {
        console.error(`Error reading documentation for ${service}:`, error);
      }
    }

    // Get Confluence configuration
    const confluenceConfig = {
      url: process.env.CONFLUENCE_URL,
      spaceKey: process.env.SPACE_KEY,
      user: process.env.CONFLUENCE_USER
    };

    return NextResponse.json({
      documentation,
      confluenceConfig,
      microservices
    });
  } catch (error) {
    console.error('Error fetching documentation:', error);
    return NextResponse.json({
      error: 'Failed to fetch documentation',
      documentation: [],
      confluenceConfig: {
        url: process.env.CONFLUENCE_URL,
        spaceKey: process.env.SPACE_KEY,
        user: process.env.CONFLUENCE_USER
      },
      microservices: ['identityprovider', 'enrollment', 'usermanagement', 'vehiclemanagement']
    });
  }
}
