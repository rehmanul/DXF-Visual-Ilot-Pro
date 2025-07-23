// Integration script to replace mock data with real CAD processing results
// This connects the Python CAD processor with the web application

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class RealCADIntegration {
    constructor() {
        this.realDataCache = new Map();
    }

    async processRealCADFile(filePath, filename) {
        console.log(`🔄 Processing real CAD file: ${filename}`);
        
        try {
            // Run the real CAD zone processor (not mock data)
            const pythonProcess = spawn('python3', ['process_real_cad_zones.py'], {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let error = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                error += data.toString();
            });

            return new Promise((resolve, reject) => {
                pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Real CAD processing failed: ${error}`));
                    } else {
                        try {
                            const realResults = JSON.parse(output);
                            
                            // Validate this is real data, not mock
                            if (realResults.metadata?.source !== 'real_cad_processing') {
                                reject(new Error('Mock data detected - real processing required'));
                            }
                            
                            console.log(`✅ Real processing complete: ${realResults.statistics.total_ilots} îlots placed`);
                            resolve(realResults);
                        } catch (parseError) {
                            reject(new Error(`Failed to parse real processing results: ${parseError}`));
                        }
                    }
                });
            });

        } catch (error) {
            throw new Error(`Real CAD integration failed: ${error.message}`);
        }
    }

    formatForWebApp(realResults) {
        // Convert real processing results to format expected by web application
        return {
            status: 'completed',
            source: 'real_cad_processing',
            zones: {
                no_entree: realResults.zones.no_entree,
                entree_sortie: realResults.zones.entree_sortie,
                mur: realResults.zones.mur,
                usable: realResults.zones.usable
            },
            ilots: realResults.ilots.map(ilot => ({
                id: ilot.id,
                x: ilot.center_x,
                y: ilot.center_y,
                width: ilot.width,
                height: ilot.height,
                area_m2: ilot.area_m2,
                type: ilot.type,
                capacity: ilot.capacity
            })),
            corridors: realResults.corridors,
            metrics: {
                total_ilots: realResults.statistics.total_ilots,
                total_workspace_m2: realResults.statistics.total_workspace_m2,
                space_efficiency: realResults.statistics.space_efficiency_percent,
                ilot_density: realResults.statistics.ilot_density_per_100m2
            },
            visual_stages: {
                stage1_zones: true,
                stage2_ilots: true, 
                stage3_corridors: true
            },
            ready_for_display: true
        };
    }

    generateVisualOutput(realResults) {
        // Generate the exact visuals matching user's reference images
        const spawn = require('child_process').spawn;
        
        return new Promise((resolve, reject) => {
            const visualProcess = spawn('python3', ['generate_exact_visuals.py', 'real_zones_final.json']);
            
            let output = '';
            visualProcess.stdout.on('data', (data) => output += data);
            
            visualProcess.on('close', (code) => {
                if (code === 0) {
                    const result = JSON.parse(output);
                    console.log(`✅ Exact visuals generated: ${result.visual_file}`);
                    resolve(result);
                } else {
                    reject(new Error('Visual generation failed'));
                }
            });
        });
    }
}

// Export for use in Express routes
module.exports = { RealCADIntegration };

// Test real processing if run directly
if (require.main === module) {
    const integration = new RealCADIntegration();
    
    integration.processRealCADFile('uploads/bb201d9455816f489f0d677ba3deb76e', 'apartment.dxf')
        .then(results => {
            console.log('🎯 REAL RESULTS (No Mock Data):');
            console.log(`   • ${results.statistics.total_ilots} îlots placed`);
            console.log(`   • ${results.statistics.total_workspace_m2} m² workspace`);
            console.log(`   • ${results.statistics.space_efficiency_percent}% efficiency`);
            
            return integration.generateVisualOutput(results);
        })
        .then(visuals => {
            console.log('🎨 VISUAL OUTPUT READY:');
            console.log(`   • File: ${visuals.visual_file}`);
            console.log(`   • Matches reference images: ${visuals.matches_reference_images}`);
            console.log('   • Ready for web application display!');
        })
        .catch(error => {
            console.error('❌ Real processing failed:', error.message);
        });
}