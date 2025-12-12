import { TypeDefinition, PropertyInfo, TypeConfig, PropertyPathsPluginOptions, PropertyDefinition } from '../types.js';

/**
 * 将英文复数形式转换为单数形式
 */
function toSingular(word: string): string {
  // 常见的复数转单数规则
  if (word.endsWith('ies') && word.length > 3) {
    return word.slice(0, -3) + 'y';
  }
  if (word.endsWith('es') && word.length > 2) {
    // 检查是否是特定的复数形式
    const specialCases = ['ches', 'shes', 'xes', 'ses'];
    for (const suffix of specialCases) {
      if (word.endsWith(suffix)) {
        return word.slice(0, -2);
      }
    }
    return word.slice(0, -1);
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 1) {
      return word.slice(0, -1);
  }
  return word;
}

/**
 * 检查属性是否为数组类型
 */
function isArrayProperty(name: string): boolean {
  return name.includes('[]');
}

/**
 * 检查属性是否为可选类型
 */
function isOptionalProperty(name: string): boolean {
  return name.includes('?');
}

/**
 * 获取属性名称的基础部分（移除类型修饰符）
 */
function getBasePropertyName(name: string): string {
  return name.replace(/\?/g, '').replace(/\[\]/g, '');
}

/**
 * 处理枚举类型字符串，将 "a|b|c" 转换为 "'a' | 'b' | 'c'"
 */
function processEnumType(typeString: string): string {
  if (typeof typeString !== 'string') {
    return typeString;
  }
  
  // 检查是否是枚举格式（包含 | 且不包含空格，且不是已经处理过的带引号的格式）
  if (typeString.includes('|') && !typeString.includes("'") && !typeString.includes('"')) {
    const enumValues = typeString.split('|').map(value => value.trim());
    // 确保所有值都不是空的，并且看起来像字符串字面量（不是数字、boolean等）
    if (enumValues.every(value => value && !/^\d+$/.test(value) && value !== 'true' && value !== 'false')) {
      return enumValues.map(value => `'${value}'`).join(' | ');
    }
  }
  
  return typeString;
}

/**
 * 纯函数：从属性路径生成类型名称
 */
export function generateTypeNameFromPath(path: string, typePrefix: string = '', typeSuffix: string = '', isArrayType: boolean = false): string {
  if (!path) {
    return `${typePrefix}${typeSuffix}`;
  }
  
  const segments = path.split('.');
  const lastSegment = segments[segments.length - 1]!;
  
  // 获取基础属性名称
  const baseName = getBasePropertyName(lastSegment);
  
  // 只有当属性名称以`[]`结尾时才进行复数转单数处理
  const singularSegment = isArrayType ? toSingular(baseName) : baseName;
  const capitalizedName = singularSegment.charAt(0).toUpperCase() + singularSegment.slice(1);
  
  return `${typePrefix}${capitalizedName}${typeSuffix}`;
}

export class TypeGenerator {
  private typeMap = new Map<string, TypeDefinition>();
  private propertyInfo: Record<string, PropertyInfo>;
  private generateComments: boolean;
  private typePrefix: string;
  private typeSuffix: string;

  constructor(private options: PropertyPathsPluginOptions) {
    this.propertyInfo = options.propertyInfo || {};
    this.generateComments = options.generateComments !== false;
    this.typePrefix = options.typePrefix || '';
    this.typeSuffix = options.typeSuffix || '';
  }

  /**
   * 从配置对象生成类型定义
   */
  generateTypeDefinitions(config: TypeConfig, rootTypeName: string, fileName: string): TypeDefinition[] {
    this.typeMap.clear();
    
    const rootType: TypeDefinition = {
      name: rootTypeName,
      properties: {},
      isRoot: true,
      description: '根对象类型',
      fileName
    };
    this.typeMap.set(rootTypeName, rootType);

    this.processConfigObject(config, rootType, '');

    return Array.from(this.typeMap.values());
  }

  /**
   * 递归处理配置对象
   */
  private processConfigObject(config: TypeConfig, parentType: TypeDefinition, parentPath: string): void {
    for (const [key, value] of Object.entries(config)) {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;

      // 分离关注点：分别处理类型修饰符
      const isArray = isArrayProperty(key);
      const isOptional = isOptionalProperty(key);
      const baseKey = getBasePropertyName(key);
      const basePath = parentPath ? `${parentPath}.${baseKey}` : baseKey;

      if (typeof value === 'object' && value !== null) {
        // 创建嵌套类型
        const typeName = this.generateTypeName(basePath, isArray);
        
        if (!this.typeMap.has(typeName)) {
          const newType: TypeDefinition = {
            name: typeName,
            properties: {},
            description: `${basePath} 对象类型`,
            fileName: parentType.fileName
          };
          this.typeMap.set(typeName, newType);
          
          // 创建属性定义，包含完整的元数据
          const propertyDef: PropertyDefinition = {
            type: newType,
            isArray,
            isOptional
          };

          parentType.properties[baseKey] = propertyDef;
          
          // 递归处理嵌套对象
          this.processConfigObject(value, newType, basePath);
        } else {
          const existingType = this.typeMap.get(typeName);
          if (existingType) {
            // 创建属性定义，包含完整的元数据
            const propertyDef: PropertyDefinition = {
              type: existingType,
              isArray,
              isOptional
            };
            
            parentType.properties[baseKey] = propertyDef;
          }
        }
      } else {
        // 叶子节点，直接设置类型
        const info = this.propertyInfo[currentPath];
        let typeName = info?.type || value;
        
        // 处理枚举类型
        if (typeof typeName === 'string') {
          typeName = processEnumType(typeName);
        }
        
        // 创建属性定义，包含完整的元数据
        const propertyDef: PropertyDefinition = {
          type: typeName,
          isArray,
          isOptional
        };
        
        parentType.properties[baseKey] = propertyDef;
      }
    }
  }

  /**
   * 生成 TypeScript 代码
   */
  generateTypeScriptCode(typeDefs: TypeDefinition[]): string {
    const lines: string[] = [
      '// 自动生成的类型定义 - 请勿手动修改',
      '// Generated by vite-plugin-property-paths-to-types',
      '// https://github.com/cao5zy/vite-plugin-property-paths-to-types\n',
    ];

    // 先定义所有嵌套接口（除了根接口）
    typeDefs
      .filter(type => !type.isRoot)
      .forEach(type => {
        if (this.generateComments && type.description) {
          lines.push(`/** ${type.description} */`);
        }
        lines.push(`export interface ${type.name} {`);
        
        Object.entries(type.properties).forEach(([key, propertyDef]) => {
          const typeName = this.getTypeNameFromPropertyDefinition(propertyDef);
          const propertyPath = this.findPropertyPath(type, key);
          const info = this.propertyInfo[propertyPath];
          
          if (this.generateComments) {
            const commentLines: string[] = [];
            if (info?.description) {
              commentLines.push(` * ${info.description}`);
            }
            if (info?.defaultValue !== undefined) {
              commentLines.push(` * @default ${JSON.stringify(info.defaultValue)}`);
            }
            if (commentLines.length > 0) {
              lines.push('  /**');
              lines.push(...commentLines);
              lines.push('   */');
            }
          }
          
          const propertyName = propertyDef.isOptional ? `${key}?` : key;
          lines.push(`  ${propertyName}: ${typeName};`);
        });
        
        lines.push('}\n');
      });

    // 最后定义根接口
    const rootType = typeDefs.find(type => type.isRoot);
    if (rootType) {
      if (this.generateComments && rootType.description) {
        lines.push(`/** ${rootType.description} */`);
      }
      lines.push(`export interface ${rootType.name} {`);
      
      Object.entries(rootType.properties).forEach(([key, propertyDef]) => {
          const typeName = this.getTypeNameFromPropertyDefinition(propertyDef);
          const propertyPath = key;
          const info = this.propertyInfo[propertyPath];
          
          if (this.generateComments) {
            const commentLines: string[] = [];
            if (info?.description) {
              commentLines.push(` * ${info.description}`);
            }
            if (info?.defaultValue !== undefined) {
              commentLines.push(` * @default ${JSON.stringify(info.defaultValue)}`);
            }
            if (commentLines.length > 0) {
              lines.push('  /**');
              lines.push(...commentLines);
              lines.push('   */');
            }
          }
          
          const propertyName = propertyDef.isOptional ? `${key}?` : key;
          lines.push(`  ${propertyName}: ${typeName};`);
        });
      
      lines.push('}');
    }

    return lines.join('\n');
  }

  /**
   * 从属性定义获取类型名称
   */
  private getTypeNameFromPropertyDefinition(propertyDef: PropertyDefinition): string {
    const baseType = typeof propertyDef.type === 'string' ? propertyDef.type : propertyDef.type.name;
    let result = baseType;
    if (propertyDef.isArray) {
      result = `${baseType}[]`;
    }
    return result;
  }

  /**
   * 生成类型名称
   */
  private generateTypeName(path: string, isArrayType: boolean = false): string {
    return generateTypeNameFromPath(path, this.typePrefix, this.typeSuffix, isArrayType);
  }

  /**
   * 查找属性路径
   */
  private findPropertyPath(type: TypeDefinition, key: string): string {
    // 简化实现，实际中可能需要更复杂的路径查找
    for (const [fullPath, info] of Object.entries(this.propertyInfo)) {
      const pathSegments = fullPath.split('.');
      const lastSegment = pathSegments.pop();
      if (lastSegment === key) {
        return fullPath;
      }
    }
    return key;
  }

  /**
   * 获取生成的类型名称
   */
  getGeneratedTypeNames(): string[] {
    return Array.from(this.typeMap.keys());
  }
}