import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { TypeConfig } from '../types.js';

export class FileProcessor {
  /**
   * 从文件路径读取配置
   */
  static readConfigFile(filePath: string): TypeConfig {
    const fullPath = join(process.cwd(), filePath);
    
    if (!existsSync(fullPath)) {
      throw new Error(`配置文件不存在: ${filePath}`);
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const config = JSON.parse(content);
      
      if (typeof config !== 'object' || config === null) {
        throw new Error('配置文件必须是有效的 JSON 对象');
      }
      
      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`配置文件 JSON 格式错误: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * 从文件名推导类型名称
   */
  static deriveTypeNameFromFile(filePath: string): string {
    const baseName = filePath.split('/').pop()?.replace('.json', '') || 'Unknown';
    return baseName.charAt(0).toUpperCase() + baseName.slice(1);
  }

  /**
   * 从文件名推导输出文件名
   */
  static deriveOutputFileName(filePath: string): string {
    const baseName = filePath.split('/').pop()?.replace('.json', '') || 'unknown';
    return `${baseName}.ts`;
  }

  /**
   * 验证配置对象
   */
  static validateConfig(config: TypeConfig, path: string = ''): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(config)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        // 递归验证嵌套对象
        const nestedValidation = this.validateConfig(value, currentPath);
        errors.push(...nestedValidation.errors);
      } else if (typeof value !== 'string') {
        errors.push(`属性 ${currentPath} 的值必须是字符串类型`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
