#!/usr/bin/env node

/**
 * Auto-Documentation Watcher
 * Watches Java microservices for code changes and automatically regenerates documentation
 * 
 * Usage:
 *   node watch-and-regenerate.js [service-name]
 *   node watch-and-regenerate.js all
 */

import chokidar from 'chokidar';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MICROSERVICES = ['identityprovider', 'enrollment', 'usermanagement', 'vehiclemanagement'];

// Debounce timer to avoid multiple regenerations
const DEBOUNCE_DELAY = 5000; // 5 seconds
let regenerationTimers = {};

class DocumentationWatcher {
  constructor(services) {
    this.services = Array.isArray(services) ? services : [services];
    this.watchers = [];
    this.isRegenerating = {};
  }

  start() {
    console.log('🔍 AutoDoc.AI Documentation Watcher Started\n');
    console.log('📋 Watching services:', this.services.join(', '));
    console.log('📁 Watching for changes in: **/*.java files\n');
    console.log('⚙️  Configuration:');
    console.log(`   - Debounce delay: ${DEBOUNCE_DELAY}ms`);
    console.log(`   - Auto-regeneration: ✅ Enabled\n`);
    console.log('💡 Press Ctrl+C to stop watching\n');
    console.log('─'.repeat(60) + '\n');

    this.services.forEach(service => {
      this.watchService(service);
    });
  }

  watchService(serviceName) {
    const servicePath = path.resolve(__dirname, '..', serviceName);
    const javaPattern = path.join(servicePath, 'src', '**', '*.java');

    const watcher = chokidar.watch(javaPattern, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    watcher
      .on('ready', () => {
        console.log(`✅ Watching ${serviceName} for Java file changes...`);
      })
      .on('change', (filePath) => {
        this.handleFileChange(serviceName, filePath);
      })
      .on('add', (filePath) => {
        this.handleFileChange(serviceName, filePath, 'added');
      })
      .on('unlink', (filePath) => {
        this.handleFileChange(serviceName, filePath, 'removed');
      })
      .on('error', (error) => {
        console.error(`❌ Error watching ${serviceName}:`, error);
      });

    this.watchers.push(watcher);
  }

  handleFileChange(serviceName, filePath, changeType = 'modified') {
    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`\n[${timestamp}] 📝 File ${changeType}: ${relativePath}`);

    // Clear existing timer for this service
    if (regenerationTimers[serviceName]) {
      clearTimeout(regenerationTimers[serviceName]);
      console.log(`   ⏳ Debouncing regeneration for ${serviceName}...`);
    }

    // Set new debounced timer
    regenerationTimers[serviceName] = setTimeout(() => {
      this.regenerateDocumentation(serviceName);
    }, DEBOUNCE_DELAY);
  }

  async regenerateDocumentation(serviceName) {
    if (this.isRegenerating[serviceName]) {
      console.log(`   ⏭️  Skipping ${serviceName} (already regenerating)`);
      return;
    }

    this.isRegenerating[serviceName] = true;
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[${timestamp}] 🚀 Starting documentation regeneration for ${serviceName}`);
    console.log('═'.repeat(60));

    return new Promise((resolve) => {
      const launcherPath = path.join(__dirname, 'mcp-launcher.js');
      
      const regenerateProcess = spawn('node', [launcherPath, serviceName], {
        env: {
          ...process.env,
          FORCE_REGENERATE: 'true'
        },
        stdio: 'inherit'
      });

      regenerateProcess.on('close', (code) => {
        this.isRegenerating[serviceName] = false;
        const endTimestamp = new Date().toLocaleTimeString();
        
        if (code === 0) {
          console.log(`\n${'═'.repeat(60)}`);
          console.log(`[${endTimestamp}] ✅ Documentation regenerated successfully for ${serviceName}`);
          console.log('═'.repeat(60));
          console.log('📚 Updated files:');
          console.log(`   - ${serviceName}/documentation/architecturedesign.adoc`);
          console.log(`   - ${serviceName}/documentation/detaileddesign.adoc`);
          console.log(`   - ${serviceName}/documentation/openApiSpecification.adoc`);
          console.log(`\n💡 Knowledge Base Q&A will now use the updated documentation\n`);
        } else {
          console.error(`\n❌ [${endTimestamp}] Documentation regeneration failed for ${serviceName} (exit code: ${code})\n`);
        }
        
        resolve();
      });

      regenerateProcess.on('error', (error) => {
        this.isRegenerating[serviceName] = false;
        console.error(`\n❌ Error regenerating documentation for ${serviceName}:`, error.message);
        resolve();
      });
    });
  }

  stop() {
    console.log('\n🛑 Stopping documentation watcher...');
    this.watchers.forEach(watcher => watcher.close());
    console.log('✅ Watcher stopped');
    process.exit(0);
  }
}

// CLI execution
const args = process.argv.slice(2);
const serviceArg = args[0] || 'all';

let servicesToWatch;

if (serviceArg === 'all') {
  servicesToWatch = MICROSERVICES;
} else if (MICROSERVICES.includes(serviceArg)) {
  servicesToWatch = [serviceArg];
} else {
  console.error(`❌ Invalid service: ${serviceArg}`);
  console.log(`\n💡 Valid options:`);
  console.log(`   - all (watch all microservices)`);
  MICROSERVICES.forEach(service => {
    console.log(`   - ${service}`);
  });
  process.exit(1);
}

const watcher = new DocumentationWatcher(servicesToWatch);
watcher.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  watcher.stop();
});

process.on('SIGTERM', () => {
  watcher.stop();
});
