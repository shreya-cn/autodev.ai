/**
 * Knowledge Base Indexer
 * Scans the codebase and generates metadata index WITHOUT exposing raw code
 * 
 * Usage:
 *   node build-knowledge-base.js --project /path/to/project
 */

import { TypeScriptMetadataParser, FileMetadata } from '../src/typescript-parser.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface KnowledgeBaseIndex {
  generatedAt: string;
  projectPath: string;
  totalFiles: number;
  fileTypes: Record<string, number>;
  files: FileMetadata[];
  statistics: {
    totalFunctions: number;
    totalComponents: number;
    totalTypes: number;
    totalApiRoutes: number;
  };
}

class KnowledgeBaseIndexer {
  private parser: TypeScriptMetadataParser;
  private projectRoot: string;
  private ignoredDirs = ['node_modules', 'dist', 'build', '.next', '.git', 'coverage'];
  private supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

  constructor(projectRoot: string) {
    this.parser = new TypeScriptMetadataParser();
    this.projectRoot = projectRoot;
  }

  /**
   * Build complete knowledge base index
   */
  async buildIndex(): Promise<KnowledgeBaseIndex> {
    console.log('🔍 Scanning project:', this.projectRoot);
    
    const files: FileMetadata[] = [];
    const fileTypes: Record<string, number> = {};

    // Recursively scan directory
    await this.scanDirectory(this.projectRoot, files, fileTypes);

    // Calculate statistics
    const statistics = {
      totalFunctions: files.reduce((sum, f) => sum + f.functions.length, 0),
      totalComponents: files.reduce((sum, f) => sum + f.components.length, 0),
      totalTypes: files.reduce((sum, f) => sum + f.types.length, 0),
      totalApiRoutes: files.reduce((sum, f) => sum + (f.apiRoutes?.length || 0), 0),
    };

    const index: KnowledgeBaseIndex = {
      generatedAt: new Date().toISOString(),
      projectPath: this.projectRoot,
      totalFiles: files.length,
      fileTypes,
      files,
      statistics
    };

    console.log('\n✅ Index built successfully:');
    console.log(`   📁 Files scanned: ${index.totalFiles}`);
    console.log(`   🔧 Functions: ${statistics.totalFunctions}`);
    console.log(`   ⚛️  Components: ${statistics.totalComponents}`);
    console.log(`   📝 Types: ${statistics.totalTypes}`);
    console.log(`   🌐 API Routes: ${statistics.totalApiRoutes}`);

    return index;
  }

  /**
   * Recursively scan directory for TypeScript/JavaScript files
   */
  private async scanDirectory(
    dir: string,
    files: FileMetadata[],
    fileTypes: Record<string, number>
  ): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip ignored directories
      if (entry.isDirectory()) {
        if (!this.ignoredDirs.includes(entry.name)) {
          await this.scanDirectory(fullPath, files, fileTypes);
        }
        continue;
      }

      // Process supported file types
      const ext = path.extname(entry.name);
      if (this.supportedExtensions.includes(ext)) {
        try {
          const metadata = this.parser.parseFile(fullPath, this.projectRoot);
          files.push(metadata);
          
          // Count file types
          fileTypes[metadata.type] = (fileTypes[metadata.type] || 0) + 1;
          
          console.log(`   ✓ ${metadata.relativePath}`);
        } catch (error) {
          console.error(`   ✗ Error parsing ${fullPath}:`, (error as Error).message);
        }
      }
    }
  }

  /**
   * Save index to file
   */
  saveIndex(index: KnowledgeBaseIndex, outputPath: string): void {
    fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');
    console.log(`\n💾 Index saved to: ${outputPath}`);
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(index: KnowledgeBaseIndex): string {
    const lines: string[] = [];
    
    lines.push('# Knowledge Base Summary\n');
    lines.push(`Generated: ${new Date(index.generatedAt).toLocaleString()}\n`);
    lines.push(`Project: ${index.projectPath}\n`);
    
    lines.push('\n## Statistics\n');
    lines.push(`- Total Files: ${index.totalFiles}`);
    lines.push(`- Functions: ${index.statistics.totalFunctions}`);
    lines.push(`- Components: ${index.statistics.totalComponents}`);
    lines.push(`- Types/Interfaces: ${index.statistics.totalTypes}`);
    lines.push(`- API Routes: ${index.statistics.totalApiRoutes}`);
    
    lines.push('\n## File Types Distribution\n');
    Object.entries(index.fileTypes).forEach(([type, count]) => {
      lines.push(`- ${type}: ${count}`);
    });

    lines.push('\n## API Routes\n');
    index.files
      .filter(f => f.apiRoutes && f.apiRoutes.length > 0)
      .forEach(file => {
        lines.push(`\n### ${file.relativePath}`);
        file.apiRoutes!.forEach(route => {
          lines.push(`- **${route.method}** - ${route.handler}`);
          if (route.description) {
            lines.push(`  ${route.description}`);
          }
        });
      });

    lines.push('\n## Components\n');
    const componentFiles = index.files.filter(f => f.components.length > 0);
    componentFiles.forEach(file => {
      lines.push(`\n### ${file.relativePath}`);
      file.components.forEach(comp => {
        lines.push(`- **${comp.name}**`);
        if (comp.props) {
          lines.push(`  Props: \`${comp.props}\``);
        }
        if (comp.jsDoc) {
          lines.push(`  ${comp.jsDoc}`);
        }
      });
    });

    return lines.join('\n');
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const projectArg = args.find(arg => arg.startsWith('--project='));
  
  let projectPath: string;
  
  if (projectArg) {
    projectPath = projectArg.split('=')[1];
  } else {
    // Default: scan the autodev-ui directory
    projectPath = path.resolve(__dirname, '../../autodev-ui');
  }

  if (!fs.existsSync(projectPath)) {
    console.error('❌ Project path does not exist:', projectPath);
    process.exit(1);
  }

  console.log('🚀 Knowledge Base Indexer\n');
  
  const indexer = new KnowledgeBaseIndexer(projectPath);
  
  try {
    // Build index
    const index = await indexer.buildIndex();
    
    // Save to data directory
    const dataDir = path.resolve(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const indexPath = path.join(dataDir, 'knowledge-base.json');
    indexer.saveIndex(index, indexPath);
    
    // Generate and save summary
    const summary = indexer.generateSummary(index);
    const summaryPath = path.join(dataDir, 'knowledge-base-summary.md');
    fs.writeFileSync(summaryPath, summary, 'utf-8');
    console.log(`📄 Summary saved to: ${summaryPath}`);
    
    console.log('\n✨ Knowledge base build complete!');
  } catch (error) {
    console.error('\n❌ Error building knowledge base:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { KnowledgeBaseIndexer, KnowledgeBaseIndex };
