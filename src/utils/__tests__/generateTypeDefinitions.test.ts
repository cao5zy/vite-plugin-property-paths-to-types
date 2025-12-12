import { describe, it, expect, beforeEach } from 'vitest';
import { TypeGenerator } from '../generator.js';
import { TypeConfig, PropertyPathsPluginOptions } from '../../types.js';

describe('TypeGenerator - generateTypeDefinitions', () => {
  let generator: TypeGenerator;
  const defaultOptions: PropertyPathsPluginOptions = {
    configFiles: [],
    propertyInfo: {},
    generateComments: true
  };

  beforeEach(() => {
    generator = new TypeGenerator(defaultOptions);
  });

  describe('基本功能测试', () => {
    it('应该为简单对象生成类型定义', () => {
      const config: TypeConfig = {
        name: 'string',
        age: 'number'
      };

      const typeDefs = generator.generateTypeDefinitions(config, 'User', 'user.ts');

      expect(typeDefs).toHaveLength(1);
      expect(typeDefs[0]!.name).toBe('User');
      expect(typeDefs[0]!.isRoot).toBe(true);
      expect(typeDefs[0]!.properties.name!.type).toBe('string');
      expect(typeDefs[0]!.properties.age!.type).toBe('number');
    });

    it('应该为嵌套对象生成多个类型定义', () => {
      const config: TypeConfig = {
        user: {
          name: 'string',
          profile: {
            avatar: 'string'
          }
        }
      };

      const typeDefs = generator.generateTypeDefinitions(config, 'AppConfig', 'app.ts');

      expect(typeDefs).toHaveLength(3);
      
      const rootType = typeDefs.find(t => t.isRoot);
      const userType = typeDefs.find(t => t.name === 'User');
      const profileType = typeDefs.find(t => t.name === 'Profile');

      expect(rootType).toBeDefined();
      expect(userType).toBeDefined();
      expect(profileType).toBeDefined();

      expect(rootType!.properties.user!.type).toBe(userType);
      expect(userType!.properties.profile!.type).toBe(profileType);
      expect(profileType!.properties.avatar!.type).toBe('string');
    });

    it('生成简单的枚举类型', () => {
      const config: TypeConfig = {
        shape: {
          name: 'string',
          alignment: 'left|center|right'
        }
      };

      const typeDefs = generator.generateTypeDefinitions(config, 'AppConfig', 'app.ts');

      expect(typeDefs).toHaveLength(2);
      
      const rootType = typeDefs.find(t => t.isRoot);
      const shapeType = typeDefs.find(t => t.name === 'Shape');

      expect(rootType).toBeDefined();
      expect(shapeType).toBeDefined();

      expect(rootType!.properties.shape!.type).toBe(shapeType);
      expect(shapeType!.properties.alignment!.type).toBe("'left' | 'center' | 'right'");
    });
  });

  describe('属性信息配置测试', () => {
    it('应该使用 propertyInfo 中的类型信息', () => {
      const options: PropertyPathsPluginOptions = {
        ...defaultOptions,
        propertyInfo: {
          'user.email': {
            type: 'Email',
            description: '用户邮箱地址'
          }
        }
      };

      generator = new TypeGenerator(options);
      const config: TypeConfig = {
        user: {
          email: 'string' // 这个会被 propertyInfo 覆盖
        }
      };

      const typeDefs = generator.generateTypeDefinitions(config, 'Config', 'config.ts');

      const userType = typeDefs.find(t => t.name === 'User')!;
      expect(userType.properties.email!.type).toBe('Email');
    });
  });

  describe('类型名称生成测试', () => {
    it('应该使用自定义前缀和后缀', () => {
      const options: PropertyPathsPluginOptions = {
        ...defaultOptions,
        typePrefix: 'I',
        typeSuffix: 'Type'
      };

      generator = new TypeGenerator(options);
      const config: TypeConfig = {
        user: {
          profile: {
            settings: 'object'
          }
        }
      };

      const typeDefs = generator.generateTypeDefinitions(config, 'AppConfig', 'app.ts');

      const userType = typeDefs.find(t => t.name === 'IUserType');
      const profileType = typeDefs.find(t => t.name === 'IProfileType');

      expect(userType).toBeDefined();
      expect(profileType).toBeDefined();
    });

    it('应该正确处理空路径的类型名称', () => {
      const typeName = generator['generateTypeName']('');
      expect(typeName).toBe('');
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空配置对象', () => {
      const config: TypeConfig = {};
      const typeDefs = generator.generateTypeDefinitions(config, 'EmptyConfig', 'empty.ts');

      expect(typeDefs).toHaveLength(1);
      expect(typeDefs[0]!.name).toBe('EmptyConfig');
      expect(typeDefs[0]!.properties).toEqual({});
    });

    it('应该处理 null 值', () => {
      const config: TypeConfig = {
        nullProp: null as any
      };

      const typeDefs = generator.generateTypeDefinitions(config, 'Config', 'config.ts');
      const rootType = typeDefs.find(t => t.isRoot)!;

      expect(rootType.properties.nullProp!.type).toBe(null);
    });

    it('应该为每个类型定义设置正确的文件名', () => {
      const config: TypeConfig = {
        user: {
          name: 'string'
        }
      };

      const fileName = 'test-file.ts';
      const typeDefs = generator.generateTypeDefinitions(config, 'Config', fileName);

      typeDefs.forEach(type => {
        expect(type.fileName).toBe(fileName);
      });
    });

    it('生成可以为空的属性', () => {
      const config1: TypeConfig = {
        "user?": {
          "name?": 'string'
        }
      };

      const typeDefs1 = generator.generateTypeDefinitions(config1, 'Config1', 'file1.ts');
      const code = generator.generateTypeScriptCode(typeDefs1);

      expect(typeDefs1).toHaveLength(2);
      expect(typeDefs1[0]!.name).toBe('Config1');
      expect(typeDefs1[1]!.name).toBe('User');
      expect(code).toContain('export interface User {');
      expect(code).toContain('user?:'); 
      expect(code).toContain('name?:'); 
    });
  });

  describe('类型映射管理', () => {

    it('应该在每次调用时清空类型映射', () => {
      const config1: TypeConfig = {
        user: {
          name: 'string'
        }
      };

      const config2: TypeConfig = {
        product: {
          price: 'number'
        }
      };

      const typeDefs1 = generator.generateTypeDefinitions(config1, 'Config1', 'file1.ts');
      const typeDefs2 = generator.generateTypeDefinitions(config2, 'Config2', 'file2.ts');

      expect(typeDefs1).toHaveLength(2);
      expect(typeDefs2).toHaveLength(2);
      expect(typeDefs1[0]!.name).toBe('Config1');
      expect(typeDefs2[0]!.name).toBe('Config2');
    });

    it('应该返回正确的生成类型名称列表', () => {
      const config: TypeConfig = {
        user: {
          profile: {
            settings: 'object' // settings是属性，不是类型
          }
        }
      };

      generator.generateTypeDefinitions(config, 'Config', 'config.ts');
      const typeNames = generator.getGeneratedTypeNames();

      expect(typeNames).toHaveLength(3);
      expect(typeNames).toContain('Config');
      expect(typeNames).toContain('User');
      expect(typeNames).toContain('Profile');
    });

    it('应该正确处理数组类型', () => {
      const config: TypeConfig = {
        "users[]": {
          name: 'string',
          email: 'string'
        }
      };

      const typeDefs = generator.generateTypeDefinitions(config, 'Config', 'config.ts');
      const typeNames = generator.getGeneratedTypeNames();

      expect(typeNames).toHaveLength(2);
      expect(typeNames).toContain('Config');
      expect(typeNames).toContain('User');

      const rootType = typeDefs.find(t => t.isRoot)!;
      const userType = typeDefs.find(t => t.name === 'User')!;

      // 根类型中的 users 属性应该是 User[]
      expect(rootType.properties.users!.isArray).toBe(true);
      expect(rootType.properties.users!.type).toBe(userType);
      
      // User 类型应该包含正确的属性
      expect(userType.properties.name!.type).toBe('string');
      expect(userType.properties.email!.type).toBe('string');
    });

    it('应该处理嵌套数组类型', () => {
      const config: TypeConfig = {
        "users[]": {
          "tags[]": {
            name: 'string'
          }
        }
      };

      const typeDefs = generator.generateTypeDefinitions(config, 'Config', 'config.ts');

      const rootType = typeDefs.find(t => t.isRoot)!;
      const userType = typeDefs.find(t => t.name === 'User')!;
      const tagType = typeDefs.find(t => t.name === 'Tag')!;

      expect(rootType.properties.users!.isArray).toBe(true);
      expect(rootType.properties.users!.type).toBe(userType);
      expect(userType.properties.tags!.isArray).toBe(true);
      expect(userType.properties.tags!.type).toBe(tagType);
      expect(tagType.properties.name!.type).toBe('string');
    });

    it('应该生成正确的 TypeScript 代码', () => {
      const config: TypeConfig = {
        "users[]": {
          name: 'string',
          age: 'number'
        }
      };

      const typeDefs = generator.generateTypeDefinitions(config, 'AppConfig', 'app.ts');
      const code = generator.generateTypeScriptCode(typeDefs);

      expect(code).toContain('export interface User {');
      expect(code).toContain('export interface AppConfig {');
      expect(code).toContain('users: User[];');
    });

    it('应该正确存储 isArray 和 isOptional 信息', () => {
      const config: TypeConfig = {
        "users?[]": {
          "name?": 'string'
        }
      };
      // todo: 请修复{name:generator}中的代码，使其能够实现同时是isArray和isOptional的情况
      // <file name="generator" src="src/utils/generator.ts" action="read"/>
      // <file name="types" src="src/types.ts" action="read"/>

      const typeDefs = generator.generateTypeDefinitions(config, 'Config', 'config.ts');

      const rootType = typeDefs.find(t => t.isRoot)!;
      const userType = typeDefs.find(t => t.name === 'User')!;

      expect(rootType.properties.users!.isArray).toBe(true);
      expect(rootType.properties.users!.isOptional).toBe(true);
      expect(userType.properties.name!.isArray).toBe(false);
      expect(userType.properties.name!.isOptional).toBe(true);
    });
  });
});
