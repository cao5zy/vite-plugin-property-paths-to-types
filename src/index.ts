import { Plugin } from 'vite';
import { writeFileSync, mkdirSync, existsSync, watch } from 'fs';
import { dirname, join, basename } from 'path';
import { TypeGenerator } from './utils/generator.js';
import { FileProcessor } from './utils/file-processor.js';
import type { PropertyPathsPluginOptions, TypeConfig } from './types.js';

export type { PropertyPathsPluginOptions, PropertyInfo, TypeConfig } from './types.js';

export default function propertyPathsToTypes(options: PropertyPathsPluginOptions): Plugin {
  const {
    configFiles,
    outputDir = './src/types/generated',
    watch: watchEnabled = true
  } = options;

  let isBuild = false;
  const generator = new TypeGenerator(options);

  /**
   * 处理单个配置文件
   */
  function processConfigFile(filePath: string): { fileName: string; content: string } | null {
    try {
      const config = FileProcessor.readConfigFile(filePath);
      
      // 验证配置
      const validation = FileProcessor.validateConfig(config);
      if (!validation.valid) {
        console.error(`❌ 配置文件验证失败: ${filePath}`);
        validation.errors.forEach(error => console.error(`  - ${error}`));
        return null;
      }

      const rootTypeName = options.rootTypeNames?.[filePath] || 
                         FileProcessor.deriveTypeNameFromFile(filePath);
      const outputFileName = FileProcessor.deriveOutputFileName(filePath);
      
      const typeDefs = generator.generateTypeDefinitions(config, rootTypeName, outputFileName);
      const tsCode = generator.generateTypeScriptCode(typeDefs);
      
      return {
        fileName: outputFileName,
        content: tsCode
      };
    } catch (error) {
      console.error(`❌ 处理配置文件失败: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 写入类型文件
   */
  function writeTypeFiles() {
    try {
      // 确保输出目录存在
      const fullOutputDir = join(process.cwd(), outputDir);
      if (!existsSync(fullOutputDir)) {
        mkdirSync(fullOutputDir, { recursive: true });
      }

      let successCount = 0;
      
      configFiles.forEach(filePath => {
        const result = processConfigFile(filePath);
        if (result) {
          const outputPath = join(fullOutputDir, result.fileName);
          writeFileSync(outputPath, result.content, 'utf-8');
          console.log(`✅ 类型定义已生成: ${join(outputDir, result.fileName)}`);
          successCount++;
        }
      });

      if (successCount > 0) {
        console.log(`📋 成功生成 ${successCount}/${configFiles.length} 个类型文件`);
      } else {
        console.error('❌ 所有配置文件处理失败');
      }
    } catch (error) {
      console.error('❌ 生成类型定义失败:', error);
    }
  }

  return {
    name: 'vite-plugin-property-paths-to-types',
    
    buildStart() {
      isBuild = true;
      writeTypeFiles();
    },
    
    configureServer(server) {
      if (watchEnabled && !isBuild) {
        // 监听配置文件变化，重新生成类型
        configFiles.forEach(filePath => {
          const fullPath = join(process.cwd(), filePath);
          if (existsSync(fullPath)) {
            watch(fullPath, () => {
              console.log(`🔄 检测到配置文件变化: ${filePath}`);
              writeTypeFiles();
              server.ws.send({
                type: 'full-reload'
              });
            });
          }
        });
      }
    }
  };
}
