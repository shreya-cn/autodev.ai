/**
 * TypeScript Metadata Parser
 * Extracts code structure WITHOUT exposing raw implementation
 * 
 * This parser analyzes TypeScript/TSX files and extracts:
 * - Imports and exports
 * - Function/method signatures
 * - Component definitions
 * - Type definitions
 * - File relationships
 * 
 * Privacy: NO implementation details or code bodies are extracted
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface FileMetadata {
  file: string;
  relativePath: string;
  type: 'component' | 'api-route' | 'utility' | 'type' | 'config';
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  components: ComponentInfo[];
  types: TypeInfo[];
  apiRoutes?: ApiRouteInfo[];
  dependencies: string[];
  description?: string;
}

export interface ImportInfo {
  from: string;
  names: string[];
  isDefault?: boolean;
  isTypeOnly?: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'const' | 'class' | 'type' | 'interface' | 'default';
  isAsync?: boolean;
}

export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync?: boolean;
  isExported?: boolean;
  jsDoc?: string;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface ComponentInfo {
  name: string;
  props?: string;
  isExported?: boolean;
  hooks?: string[];
  jsDoc?: string;
}

export interface TypeInfo {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  properties?: PropertyInfo[];
  jsDoc?: string;
}

export interface PropertyInfo {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

export interface ApiRouteInfo {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: string;
  description?: string;
}

export class TypeScriptMetadataParser {
  
  /**
   * Parse a TypeScript file and extract metadata
   */
  parseFile(filePath: string, projectRoot: string): FileMetadata {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const relativePath = path.relative(projectRoot, filePath);
    
    const metadata: FileMetadata = {
      file: filePath,
      relativePath,
      type: this.determineFileType(relativePath),
      imports: [],
      exports: [],
      functions: [],
      components: [],
      types: [],
      dependencies: [],
    };

    // Extract JSDoc comment from file top
    const fileComment = this.extractLeadingComment(sourceFile);
    if (fileComment) {
      metadata.description = fileComment;
    }

    // Detect API routes
    if (metadata.type === 'api-route') {
      metadata.apiRoutes = this.extractApiRoutes(sourceFile);
    }

    // Walk the AST and extract metadata
    const visit = (node: ts.Node) => {
      // Extract imports
      if (ts.isImportDeclaration(node)) {
        metadata.imports.push(this.extractImport(node));
      }

      // Extract exports
      if (this.isExportDeclaration(node)) {
        const exportInfo = this.extractExport(node);
        if (exportInfo) {
          metadata.exports.push(exportInfo);
        }
      }

      // Extract functions
      if (ts.isFunctionDeclaration(node) && node.name) {
        metadata.functions.push(this.extractFunction(node));
      }

      // Extract arrow functions / const functions
      if (ts.isVariableStatement(node)) {
        const func = this.extractVariableFunction(node);
        if (func) {
          metadata.functions.push(func);
        }
      }

      // Extract React components
      if (this.isReactComponent(node)) {
        const component = this.extractComponent(node);
        if (component) {
          metadata.components.push(component);
        }
      }

      // Extract types and interfaces
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
        metadata.types.push(this.extractType(node));
      }

      // Extract enums
      if (ts.isEnumDeclaration(node)) {
        metadata.types.push(this.extractEnum(node));
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    // Build dependency list from imports
    metadata.dependencies = metadata.imports
      .map(imp => imp.from)
      .filter(from => !from.startsWith('.') && !from.startsWith('@/'));

    return metadata;
  }

  private determineFileType(relativePath: string): FileMetadata['type'] {
    if (relativePath.includes('/api/')) return 'api-route';
    if (relativePath.includes('/components/')) return 'component';
    if (relativePath.includes('/types/') || relativePath.endsWith('.d.ts')) return 'type';
    if (relativePath.endsWith('config.ts') || relativePath.endsWith('config.js')) return 'config';
    return 'utility';
  }

  private extractImport(node: ts.ImportDeclaration): ImportInfo {
    const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
    const names: string[] = [];
    let isDefault = false;
    let isTypeOnly = node.importClause?.isTypeOnly || false;

    if (node.importClause) {
      // Default import
      if (node.importClause.name) {
        names.push(node.importClause.name.text);
        isDefault = true;
      }

      // Named imports
      if (node.importClause.namedBindings) {
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach(element => {
            names.push(element.name.text);
          });
        }
        // Namespace import (import * as X)
        else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          names.push(node.importClause.namedBindings.name.text);
        }
      }
    }

    return { from: moduleSpecifier, names, isDefault, isTypeOnly };
  }

  private isExportDeclaration(node: ts.Node): boolean {
    return !!(
      ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export
    );
  }

  private extractExport(node: ts.Node): ExportInfo | null {
    if (ts.isFunctionDeclaration(node) && node.name) {
      return {
        name: node.name.text,
        type: 'function',
        isAsync: !!(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword))
      };
    }

    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];
      if (declaration.name && ts.isIdentifier(declaration.name)) {
        return {
          name: declaration.name.text,
          type: 'const',
        };
      }
    }

    if (ts.isClassDeclaration(node) && node.name) {
      return {
        name: node.name.text,
        type: 'class'
      };
    }

    if (ts.isInterfaceDeclaration(node)) {
      return {
        name: node.name.text,
        type: 'interface'
      };
    }

    if (ts.isTypeAliasDeclaration(node)) {
      return {
        name: node.name.text,
        type: 'type'
      };
    }

    return null;
  }

  private extractFunction(node: ts.FunctionDeclaration): FunctionInfo {
    const name = node.name?.text || 'anonymous';
    const parameters = node.parameters.map(p => this.extractParameter(p));
    const returnType = node.type?.getText();
    const isAsync = !!(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));
    const isExported = this.isExportDeclaration(node);
    const jsDoc = this.extractJsDoc(node);

    return { name, parameters, returnType, isAsync, isExported, jsDoc };
  }

  private extractVariableFunction(node: ts.VariableStatement): FunctionInfo | null {
    const declaration = node.declarationList.declarations[0];
    
    if (!declaration.initializer) return null;
    
    if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) {
      const name = ts.isIdentifier(declaration.name) ? declaration.name.text : 'anonymous';
      const func = declaration.initializer;
      const parameters = func.parameters.map(p => this.extractParameter(p));
      const returnType = func.type?.getText();
      const isAsync = !!(func.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));
      const isExported = this.isExportDeclaration(node);
      const jsDoc = this.extractJsDoc(node);

      return { name, parameters, returnType, isAsync, isExported, jsDoc };
    }

    return null;
  }

  private extractParameter(param: ts.ParameterDeclaration): ParameterInfo {
    const name = param.name.getText();
    const type = param.type?.getText();
    const optional = !!param.questionToken;
    const defaultValue = param.initializer?.getText();

    return { name, type, optional, defaultValue };
  }

  private isReactComponent(node: ts.Node): boolean {
    // Check for function component
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      // React components start with uppercase
      if (name[0] === name[0].toUpperCase()) {
        // Check if returns JSX
        const returnType = node.type?.getText();
        if (returnType?.includes('JSX.Element') || returnType?.includes('ReactElement')) {
          return true;
        }
      }
    }

    // Check for arrow function component
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];
      if (declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
        const name = declaration.name.getText();
        if (name[0] === name[0].toUpperCase()) {
          const returnType = declaration.type?.getText();
          if (returnType?.includes('JSX.Element') || returnType?.includes('ReactElement')) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private extractComponent(node: ts.Node): ComponentInfo | null {
    let name = '';
    let props = '';
    let parameters: ts.NodeArray<ts.ParameterDeclaration> | undefined;
    let isExported = false;
    let jsDoc = '';

    if (ts.isFunctionDeclaration(node) && node.name) {
      name = node.name.text;
      parameters = node.parameters;
      isExported = this.isExportDeclaration(node);
      jsDoc = this.extractJsDoc(node);
    } else if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];
      name = declaration.name.getText();
      if (declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
        parameters = declaration.initializer.parameters;
      }
      isExported = this.isExportDeclaration(node);
      jsDoc = this.extractJsDoc(node);
    }

    if (parameters && parameters.length > 0) {
      props = parameters[0].type?.getText() || '';
    }

    // TODO: Extract hooks usage (useState, useEffect, etc.)
    const hooks: string[] = [];

    return { name, props, isExported, hooks, jsDoc };
  }

  private extractType(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): TypeInfo {
    const name = node.name.text;
    const kind = ts.isInterfaceDeclaration(node) ? 'interface' : 'type';
    const jsDoc = this.extractJsDoc(node);
    const properties: PropertyInfo[] = [];

    if (ts.isInterfaceDeclaration(node)) {
      node.members.forEach(member => {
        if (ts.isPropertySignature(member) && member.name) {
          properties.push({
            name: member.name.getText(),
            type: member.type?.getText() || 'unknown',
            optional: !!member.questionToken,
            description: this.extractJsDoc(member)
          });
        }
      });
    }

    return { name, kind, properties, jsDoc };
  }

  private extractEnum(node: ts.EnumDeclaration): TypeInfo {
    const name = node.name.text;
    const jsDoc = this.extractJsDoc(node);
    const properties: PropertyInfo[] = node.members.map(member => ({
      name: member.name.getText(),
      type: 'enum-member',
      description: this.extractJsDoc(member)
    }));

    return { name, kind: 'enum', properties, jsDoc };
  }

  private extractApiRoutes(sourceFile: ts.SourceFile): ApiRouteInfo[] {
    const routes: ApiRouteInfo[] = [];
    const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = node.name.text;
        const upperName = name.toUpperCase();
        
        if (httpMethods.includes(upperName)) {
          routes.push({
            method: upperName as any,
            handler: name,
            description: this.extractJsDoc(node)
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return routes;
  }

  private extractJsDoc(node: ts.Node): string | undefined {
    const jsDoc = (node as any).jsDoc;
    if (jsDoc && jsDoc.length > 0) {
      return jsDoc[0].comment || undefined;
    }
    return undefined;
  }

  private extractLeadingComment(sourceFile: ts.SourceFile): string | undefined {
    const text = sourceFile.getFullText();
    const comments = ts.getLeadingCommentRanges(text, 0);
    
    if (comments && comments.length > 0) {
      const comment = text.substring(comments[0].pos, comments[0].end);
      return comment.replace(/^\/\*+|\*+\/$/g, '').trim();
    }
    
    return undefined;
  }
}
