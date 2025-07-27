#!/usr/bin/env node

/**
 * DXF Visual Ilot Pro - Comprehensive Health Check
 * Validates all critical systems and provides actionable recommendations
 */

import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

class HealthChecker {
  constructor() {
    this.results = {
      critical: [],
      warnings: [],
      passed: [],
      recommendations: []
    };
  }

  async runFullHealthCheck() {
    console.log('🏥 DXF Visual Ilot Pro - Health Check');
    console.log('=====================================\n');

    // Core System Checks
    await this.checkProjectStructure();
    await this.checkDependencies();
    await this.checkTypeScriptConfig();
    await this.checkCoreServices();
    await this.checkTestSuite();
    await this.checkPythonEnvironment();
    await this.checkAssets();
    
    // Generate Report
    this.generateHealthReport();
    
    return this.results;
  }

  async checkProjectStructure() {
    console.log('📁 Checking Project Structure...');
    
    const requiredDirs = [
      'client/src',
      'server/services', 
      'scripts',
      'shared',
      'uploads',
      'attached_assets'
    ];
    
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'README.md',
      'server/index.ts',
      'client/src/App.tsx',
      'shared/schema.ts'
    ];
    
    for (const dir of requiredDirs) {
      if (existsSync(dir)) {
        this.results.passed.push(`✅ Directory exists: ${dir}`);
      } else {
        this.results.critical.push(`❌ Missing directory: ${dir}`);
      }
    }
    
    for (const file of requiredFiles) {
      if (existsSync(file)) {
        this.results.passed.push(`✅ File exists: ${file}`);
      } else {
        this.results.critical.push(`❌ Missing file: ${file}`);
      }
    }
  }

  async checkDependencies() {
    console.log('📦 Checking Dependencies...');
    
    try {
      const packageJson = JSON.parse(
        await import('fs').then(fs => fs.readFileSync('package.json', 'utf8'))
      );
      
      const criticalDeps = [
        'express',
        'react',
        'typescript',
        'vite',
        'drizzle-orm',
        'socket.io'
      ];
      
      for (const dep of criticalDeps) {
        if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
          this.results.passed.push(`✅ Dependency found: ${dep}`);
        } else {
          this.results.critical.push(`❌ Missing dependency: ${dep}`);
        }
      }
      
      // Check for security vulnerabilities
      try {
        execSync('npm audit --audit-level=moderate', { stdio: 'pipe' });
        this.results.passed.push('✅ No moderate+ security vulnerabilities');
      } catch (error) {
        this.results.warnings.push('⚠️ Security vulnerabilities detected - run npm audit fix');
      }
      
    } catch (error) {
      this.results.critical.push('❌ Cannot read package.json');
    }
  }

  async checkTypeScriptConfig() {
    console.log('🔧 Checking TypeScript Configuration...');
    
    if (existsSync('tsconfig.json')) {
      try {
        const tsConfig = JSON.parse(
          await import('fs').then(fs => fs.readFileSync('tsconfig.json', 'utf8'))
        );
        
        const requiredOptions = ['strict', 'esModuleInterop', 'skipLibCheck'];
        
        for (const option of requiredOptions) {
          if (tsConfig.compilerOptions?.[option]) {
            this.results.passed.push(`✅ TypeScript option enabled: ${option}`);
          } else {
            this.results.warnings.push(`⚠️ TypeScript option missing: ${option}`);
          }
        }
        
        // Check type checking
        try {
          execSync('npx tsc --noEmit', { stdio: 'pipe' });
          this.results.passed.push('✅ TypeScript compilation successful');
        } catch (error) {
          this.results.warnings.push('⚠️ TypeScript compilation errors detected');
        }
        
      } catch (error) {
        this.results.critical.push('❌ Invalid tsconfig.json');
      }
    }
  }

  async checkCoreServices() {
    console.log('⚙️ Checking Core Services...');
    
    const coreServices = [
      'server/services/ilotPlacement.ts',
      'server/services/corridorGenerator.ts',
      'server/services/corridorOptimizer.ts',
      'server/services/cadProcessor.ts',
      'server/services/exportService.ts'
    ];
    
    for (const service of coreServices) {
      if (existsSync(service)) {
        const stats = statSync(service);
        if (stats.size > 1000) { // At least 1KB
          this.results.passed.push(`✅ Service implemented: ${service}`);
        } else {
          this.results.warnings.push(`⚠️ Service too small: ${service}`);
        }
      } else {
        this.results.critical.push(`❌ Missing service: ${service}`);
      }
    }
    
    // Check service exports
    const serviceChecks = [
      { file: 'server/services/ilotPlacement.ts', export: 'ilotPlacementService' },
      { file: 'server/services/corridorGenerator.ts', export: 'corridorGenerator' }
    ];
    
    for (const check of serviceChecks) {
      if (existsSync(check.file)) {
        try {
          const content = await import('fs').then(fs => fs.readFileSync(check.file, 'utf8'));
          if (content.includes(`export const ${check.export}`) || content.includes(`export { ${check.export} }`)) {
            this.results.passed.push(`✅ Service export found: ${check.export}`);
          } else {
            this.results.warnings.push(`⚠️ Service export missing: ${check.export}`);
          }
        } catch (error) {
          this.results.warnings.push(`⚠️ Cannot read service: ${check.file}`);
        }
      }
    }
  }

  async checkTestSuite() {
    console.log('🧪 Checking Test Suite...');
    
    const testFiles = [
      'test-full-corridor-system.js',
      'tests/corridor-generator.test.ts'
    ];
    
    for (const testFile of testFiles) {
      if (existsSync(testFile)) {
        this.results.passed.push(`✅ Test file exists: ${testFile}`);
      } else {
        this.results.warnings.push(`⚠️ Missing test file: ${testFile}`);
      }
    }
    
    // Try to run the main test
    try {
      execSync('npx tsx test-full-corridor-system.js', { stdio: 'pipe', timeout: 30000 });
      this.results.passed.push('✅ Main test suite passes');
    } catch (error) {
      this.results.critical.push('❌ Main test suite fails');
      this.results.recommendations.push('Run: npx tsx test-full-corridor-system.js to debug');
    }
  }

  async checkPythonEnvironment() {
    console.log('🐍 Checking Python Environment...');
    
    try {
      execSync('python --version', { stdio: 'pipe' });
      this.results.passed.push('✅ Python is available');
      
      if (existsSync('scripts/requirements.txt')) {
        this.results.passed.push('✅ Python requirements file exists');
        
        // Check if requirements are installed
        const requirements = await import('fs').then(fs => 
          fs.readFileSync('scripts/requirements.txt', 'utf8')
        );
        
        const packages = requirements.split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.split('>=')[0].split('==')[0]);
        
        for (const pkg of packages) {
          try {
            execSync(`python -c "import ${pkg.replace('-', '_')}"`, { stdio: 'pipe' });
            this.results.passed.push(`✅ Python package installed: ${pkg}`);
          } catch (error) {
            this.results.warnings.push(`⚠️ Python package missing: ${pkg}`);
            this.results.recommendations.push(`Install: pip install ${pkg}`);
          }
        }
      } else {
        this.results.warnings.push('⚠️ Python requirements.txt missing');
      }
      
    } catch (error) {
      this.results.warnings.push('⚠️ Python not available or not in PATH');
      this.results.recommendations.push('Install Python 3.8+ and add to PATH');
    }
  }

  async checkAssets() {
    console.log('🖼️ Checking Assets...');
    
    if (existsSync('attached_assets')) {
      const files = await import('fs').then(fs => fs.readdirSync('attached_assets'));
      
      const dxfFiles = files.filter(f => f.endsWith('.dxf')).length;
      const dwgFiles = files.filter(f => f.endsWith('.dwg')).length;
      const imageFiles = files.filter(f => f.match(/\.(png|jpg|jpeg)$/i)).length;
      
      this.results.passed.push(`✅ Asset files: ${dxfFiles} DXF, ${dwgFiles} DWG, ${imageFiles} images`);
      
      if (dxfFiles === 0 && dwgFiles === 0) {
        this.results.warnings.push('⚠️ No CAD test files found');
        this.results.recommendations.push('Add sample DXF/DWG files for testing');
      }
    } else {
      this.results.warnings.push('⚠️ Assets directory missing');
    }
  }

  generateHealthReport() {
    console.log('\n📊 HEALTH REPORT');
    console.log('=================\n');
    
    console.log(`✅ Passed: ${this.results.passed.length}`);
    console.log(`⚠️ Warnings: ${this.results.warnings.length}`);
    console.log(`❌ Critical: ${this.results.critical.length}\n`);
    
    if (this.results.critical.length > 0) {
      console.log('🚨 CRITICAL ISSUES:');
      this.results.critical.forEach(issue => console.log(`   ${issue}`));
      console.log('');
    }
    
    if (this.results.warnings.length > 0) {
      console.log('⚠️ WARNINGS:');
      this.results.warnings.forEach(warning => console.log(`   ${warning}`));
      console.log('');
    }
    
    if (this.results.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach(rec => console.log(`   ${rec}`));
      console.log('');
    }
    
    // Overall health score
    const totalChecks = this.results.passed.length + this.results.warnings.length + this.results.critical.length;
    const healthScore = Math.round((this.results.passed.length / totalChecks) * 100);
    
    console.log(`🏥 OVERALL HEALTH: ${healthScore}%`);
    
    if (healthScore >= 90) {
      console.log('🎉 Excellent! System is production-ready.');
    } else if (healthScore >= 75) {
      console.log('👍 Good! Minor issues to address.');
    } else if (healthScore >= 60) {
      console.log('⚠️ Fair! Several issues need attention.');
    } else {
      console.log('🚨 Poor! Critical issues must be fixed.');
    }
    
    return healthScore;
  }
}

// Run health check if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new HealthChecker();
  checker.runFullHealthCheck().then(results => {
    const criticalCount = results.critical.length;
    process.exit(criticalCount > 0 ? 1 : 0);
  });
}

export { HealthChecker };