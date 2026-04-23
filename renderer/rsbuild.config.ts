import { defineConfig, mergeRsbuildConfig, RsbuildPluginAPI } from '@rsbuild/core';
import supportedVersions from '../src/supportedVersions.mjs'
import childProcess from 'child_process'
import path, { dirname, join } from 'path'
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import fs from 'fs'
import fsExtra from 'fs-extra'
import { appAndRendererSharedConfig, rspackViewerConfig } from './rsbuildSharedConfig';

const mcDataPath = join(__dirname, '../generated/minecraft-data-optimized.json')

// if (!fs.existsSync('./playground/textures')) {
//     fsExtra.copySync('node_modules/mc-assets/dist/other-textures/latest/entity', './playground/textures/entity')
// }

if (!fs.existsSync(mcDataPath)) {
    childProcess.execSync('tsx ./scripts/makeOptimizedMcData.mjs', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
}

export default mergeRsbuildConfig(
    appAndRendererSharedConfig(),
    defineConfig({
        html: {
            template: join(__dirname, './playground.html'),
        },
        output: {
            cleanDistPath: false,
            distPath: {
                root: join(__dirname, './dist'),
            },
        },
        server: {
            port: 9090,
        },
        source: {
            entry: {
                index: join(__dirname, './playground/playground.ts')
            },
            define: {
                'globalThis.includedVersions': JSON.stringify(supportedVersions),
            },
        },
        plugins: [
            {
                name: 'test',
                setup (build: RsbuildPluginAPI) {
                    const prep = async () => {
                        fsExtra.copySync(join(__dirname, '../node_modules/mc-assets/dist/other-textures/latest/entity'), join(__dirname, './dist/textures/entity'))
                    }
                    build.onBeforeBuild(async () => {
                        await prep()
                    })
                    build.onBeforeStartDevServer(() => prep())
            },
            },
        ],
    })
)
