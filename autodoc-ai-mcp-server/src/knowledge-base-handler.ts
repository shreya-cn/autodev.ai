/**
 * Knowledge Base Query Handler
 * Handles queries to the code knowledge base using metadata only
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { FileMetadata } from './typescript-parser.js';

export interface KnowledgeBaseIndex {
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

export interface QueryResult {
  answer: string;
  sources: SourceReference[];
  confidence: 'high' | 'medium' | 'low';
  suggestedFollowUps?: string[];
}

export interface SourceReference {
  file: string;
  type: string;
  relevance: number;
  snippet?: string;
}

export class KnowledgeBaseQueryHandler {
  private openai: OpenAI;
  private index: KnowledgeBaseIndex | null = null;
  private indexPath: string;

  constructor(openaiApiKey: string, dataDir: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.indexPath = path.join(dataDir, 'knowledge-base.json');
  }

  /**
   * Load knowledge base index
   */
  loadIndex(): void {
    if (!fs.existsSync(this.indexPath)) {
      throw new Error(`Knowledge base not found at ${this.indexPath}. Run build-knowledge-base.js first.`);
    }

    const data = fs.readFileSync(this.indexPath, 'utf-8');
    this.index = JSON.parse(data);
    console.log(`📚 Loaded knowledge base: ${this.index!.totalFiles} files indexed`);
  }

  /**
   * Query the knowledge base
   */
  async query(question: string): Promise<QueryResult> {
    if (!this.index) {
      this.loadIndex();
    }

    // Step 1: Find relevant files/chunks using keyword search
    const relevantChunks = this.findRelevantChunks(question);

    if (relevantChunks.length === 0) {
      return {
        answer: "I couldn't find any relevant information in the codebase for this question. The code structure doesn't contain matching components, functions, or files related to your query.",
        sources: [],
        confidence: 'low'
      };
    }

    // Step 2: Build context from metadata
    const context = this.buildContext(relevantChunks);

    // Step 3: Generate answer using LLM
    const answer = await this.generateAnswer(question, context);

    // Step 4: Build source references
    const sources: SourceReference[] = relevantChunks.slice(0, 5).map(chunk => ({
      file: chunk.file.relativePath,
      type: chunk.file.type,
      relevance: chunk.score,
      snippet: this.generateSnippet(chunk.file)
    }));

    // Step 5: Determine confidence
    const confidence = this.calculateConfidence(relevantChunks);

    return {
      answer,
      sources,
      confidence,
      suggestedFollowUps: this.generateFollowUps(question, relevantChunks)
    };
  }

  /**
   * Find relevant code chunks using keyword matching
   */
  private findRelevantChunks(question: string): Array<{ file: FileMetadata; score: number }> {
    const keywords = this.extractKeywords(question);
    const scored: Array<{ file: FileMetadata; score: number }> = [];

    this.index!.files.forEach(file => {
      let score = 0;
      const searchText = JSON.stringify(file).toLowerCase();

      keywords.forEach(keyword => {
        const count = (searchText.match(new RegExp(keyword, 'g')) || []).length;
        score += count * 10;
      });

      // Boost score for certain file types based on question context
      if (question.toLowerCase().includes('api') && file.type === 'api-route') score *= 2;
      if (question.toLowerCase().includes('component') && file.type === 'component') score *= 2;
      if (question.toLowerCase().includes('type') && file.type === 'type') score *= 1.5;

      // Add file path matching
      keywords.forEach(keyword => {
        if (file.relativePath.toLowerCase().includes(keyword)) {
          score += 20;
        }
      });

      if (score > 0) {
        scored.push({ file, score });
      }
    });

    // Sort by score and return top results
    return scored.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  /**
   * Extract keywords from question
   */
  private extractKeywords(question: string): string[] {
    const stopWords = new Set(['how', 'what', 'where', 'when', 'why', 'who', 'does', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'work', 'works', 'working']);
    
    const words = question
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)];
  }

  /**
   * Build context string from relevant chunks
   */
  private buildContext(chunks: Array<{ file: FileMetadata; score: number }>): string {
    const contextParts: string[] = [];

    chunks.slice(0, 5).forEach(({ file }) => {
      let filePart = `\n### File: ${file.relativePath}\n`;
      filePart += `Type: ${file.type}\n`;

      if (file.description) {
        filePart += `Description: ${file.description}\n`;
      }

      if (file.apiRoutes && file.apiRoutes.length > 0) {
        filePart += `\nAPI Routes:\n`;
        file.apiRoutes.forEach(route => {
          filePart += `- ${route.method} ${route.handler}`;
          if (route.description) filePart += `: ${route.description}`;
          filePart += '\n';
        });
      }

      if (file.functions.length > 0) {
        filePart += `\nFunctions:\n`;
        file.functions.slice(0, 5).forEach(func => {
          const params = func.parameters.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
          filePart += `- ${func.name}(${params})`;
          if (func.returnType) filePart += ` → ${func.returnType}`;
          if (func.jsDoc) filePart += `\n  ${func.jsDoc}`;
          filePart += '\n';
        });
      }

      if (file.components.length > 0) {
        filePart += `\nComponents:\n`;
        file.components.forEach(comp => {
          filePart += `- ${comp.name}`;
          if (comp.props) filePart += `(${comp.props})`;
          if (comp.jsDoc) filePart += `\n  ${comp.jsDoc}`;
          filePart += '\n';
        });
      }

      if (file.types.length > 0) {
        filePart += `\nTypes/Interfaces:\n`;
        file.types.slice(0, 3).forEach(type => {
          filePart += `- ${type.kind} ${type.name}`;
          if (type.jsDoc) filePart += `: ${type.jsDoc}`;
          filePart += '\n';
        });
      }

      if (file.imports.length > 0) {
        const externalDeps = file.imports.filter(i => !i.from.startsWith('.'));
        if (externalDeps.length > 0) {
          filePart += `\nExternal Dependencies: ${externalDeps.map(i => i.from).join(', ')}\n`;
        }
      }

      contextParts.push(filePart);
    });

    return contextParts.join('\n---\n');
  }

  /**
   * Generate answer using OpenAI
   */
  private async generateAnswer(question: string, context: string): Promise<string> {
    const systemPrompt = `You are an expert code assistant for the AutoDev.ai project.

You answer questions based on CODE STRUCTURE METADATA ONLY - you do NOT see actual code implementation.

Project Info:
- Tech Stack: Next.js, TypeScript, React, NextAuth, Jira API
- Microservices: identityprovider, usermanagement, enrollment, vehiclemanagement

When answering:
1. Use ONLY the provided metadata - don't make assumptions about implementation
2. Explain architecture and structure clearly
3. Reference specific files and line locations when relevant
4. Be honest if you don't have enough metadata to answer fully
5. Suggest what the user should look at in the actual code files
6. Format answers with clear sections and examples

Remember: You see structure (classes, functions, types) but NOT implementation details.`;

    const userPrompt = `Based on this code structure metadata:\n\n${context}\n\nQuestion: ${question}\n\nProvide a clear, helpful answer based on the code structure.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Lower for factual accuracy
      max_tokens: 1000
    });

    return response.choices[0].message.content || 'Unable to generate answer.';
  }

  /**
   * Generate a snippet preview for a file
   */
  private generateSnippet(file: FileMetadata): string {
    const parts: string[] = [];

    if (file.functions.length > 0) {
      parts.push(`Functions: ${file.functions.slice(0, 3).map(f => f.name).join(', ')}`);
    }

    if (file.components.length > 0) {
      parts.push(`Components: ${file.components.map(c => c.name).join(', ')}`);
    }

    if (file.apiRoutes && file.apiRoutes.length > 0) {
      parts.push(`Routes: ${file.apiRoutes.map(r => r.method).join(', ')}`);
    }

    return parts.join(' | ') || 'No details';
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(chunks: Array<{ file: FileMetadata; score: number }>): 'high' | 'medium' | 'low' {
    if (chunks.length === 0) return 'low';
    
    const topScore = chunks[0].score;
    
    if (topScore > 100) return 'high';
    if (topScore > 50) return 'medium';
    return 'low';
  }

  /**
   * Generate follow-up question suggestions
   */
  private generateFollowUps(question: string, chunks: Array<{ file: FileMetadata; score: number }>): string[] {
    const suggestions: string[] = [];

    // Suggest based on found files
    if (chunks.some(c => c.file.type === 'api-route')) {
      suggestions.push('What are all the API endpoints available?');
    }

    if (chunks.some(c => c.file.type === 'component')) {
      suggestions.push('Which components use this functionality?');
    }

    if (chunks.some(c => c.file.dependencies.length > 0)) {
      suggestions.push('What are the main dependencies for this feature?');
    }

    return suggestions.slice(0, 3);
  }
}
