export interface TypeDefinition {
  name: string;
  properties: Record<string, PropertyDefinition>;
  isRoot?: boolean;
  description?: string;
  fileName?: string;
}

export interface PropertyDefinition {
  type: string | TypeDefinition;
  isArray?: boolean;
  isOptional?: boolean;
}

export interface PropertyInfo {
  type: string;
  description?: string;
  defaultValue?: any;
  required?: boolean;
}

export interface TypeConfig {
  [key: string]: string | TypeConfig;
}

export interface PropertyPathsPluginOptions {
  /**
   * 配置文件路径数组
   * @example ['./src/types/app.json', './src/types/database.json']
   */
  configFiles: string[];
  /**
   * 输出目录
   * @default './src/types/generated'
   */
  outputDir?: string;
  /**
   * 开发模式下是否监听变化
   * @default true
   */
  watch?: boolean;
  /**
   * 属性信息映射，用于自定义类型和描述
   */
  propertyInfo?: Record<string, PropertyInfo>;
  /**
   * 是否生成 JSDoc 注释
   * @default true
   */
  generateComments?: boolean;
  /**
   * 自定义类型前缀
   */
  typePrefix?: string;
  /**
   * 自定义类型后缀
   */
  typeSuffix?: string;
  /**
   * 根类型名称映射，key为文件名，value为类型名
   */
  rootTypeNames?: Record<string, string>;
}