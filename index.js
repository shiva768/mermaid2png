#!/usr/bin/env node
const commander = require('commander')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

const pkg = require('./package.json')

const error = message => {
    console.log(chalk.red(`\n${message}\n`))
    process.exit(1)
}

const checkConfigFile = file => {
    if (!fs.existsSync(file)) {
        error(`Configuration file "${file}" doesn't exist`)
    }
}

commander
    .version(pkg.version)
    .option('-t, --theme [theme]', 'Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default', /^default|forest|dark|neutral$/, 'default')
    .option('-w, --width [width]', 'Width of the page. Optional. Default: 800', /^\d+$/, '800')
    .option('-H, --height [height]', 'Height of the page. Optional. Default: 600', /^\d+$/, '600')
    .option('-i, --input <input>', 'Input mermaid file. Required.')
    .option('-b, --backgroundColor [backgroundColor]', 'Background color. Example: transparent, red, \'#F0F0F0\'. Optional. Default: white')
    .option('-c, --configFile [configFile]', 'JSON configuration file for mermaid. Optional')
    .option('-C, --cssFile [cssFile]', 'CSS file for the page. Optional')
    .option('-p --puppeteerConfigFile [puppeteerConfigFile]', 'JSON configuration file for puppeteer. Optional')
    .parse(process.argv)

let { theme, width, height, input, backgroundColor, configFile, cssFile, puppeteerConfigFile } = commander

// check input file
if (!input) {
    error('Please specify input Directory: -i <input>')
}
if (!fs.existsSync(input) && !fs.statSync(input).isDirectory()) {
    error(`Input Directory "${input}" doesn't exist`)
}

// check config files
let mermaidConfig = { theme }
if (configFile) {
    checkConfigFile(configFile)
    mermaidConfig = Object.assign(mermaidConfig, JSON.parse(fs.readFileSync(configFile, 'utf-8')))
}
let puppeteerConfig = {}
if (puppeteerConfigFile) {
    checkConfigFile(puppeteerConfigFile)
    puppeteerConfig = JSON.parse(fs.readFileSync(puppeteerConfigFile, 'utf-8'))
}

// check cssFile
let myCSS
if (cssFile) {
    if (!fs.existsSync(cssFile)) {
        error(`CSS file "${cssFile}" doesn't exist`)
    }
    myCSS = fs.readFileSync(cssFile, 'utf-8')
}

// normalize args
width = parseInt(width)
height = parseInt(height)
backgroundColor = backgroundColor || 'white';

const outputDir = input + '/assets'
if(!fs.existsSync(outputDir))
    fs.mkdirSync(outputDir)
const files = fs.readdirSync(input)
const filterdFiles = files.filter(f => f.endsWith('md'));
const replaceMarkdown = (outputPath, md, target) => {
    return md.replace(target, '<img src="' + outputPath + '">')
}
(async () => {
    const browser = await puppeteer.launch(puppeteerConfig)

    for await (let f of filterdFiles){
        const md = fs.readFileSync(input + '/' + f, 'utf-8')
        const regexp = /.*```mermaid([\s\S]+?)```/gm
        let match;
        let count = 0
        let replacedMd = md
        while ((match = await regexp.exec(md))!== null) {
            const page = await browser.newPage()
            page.setViewport({ width, height })
            await page.goto(`file://${path.join(__dirname, 'index.html')}`)
            await page.evaluate(`document.body.style.background = '${backgroundColor}'`)
            await page.$eval('#container', (container, definition, mermaidConfig, myCSS) => {
                container.innerHTML = definition
                window.mermaid.initialize(mermaidConfig)
                if (myCSS) {
                    const head = window.document.head || window.document.getElementsByTagName('head')[0]
                    const style = document.createElement('style')
                    style.type = 'text/css'
                    if (style.styleSheet) {
                        style.styleSheet.cssText = myCSS
                    } else {
                        style.appendChild(document.createTextNode(myCSS))
                    }
                    head.appendChild(style)
                }

                window.mermaid.init(undefined, container)
            }, match[1], mermaidConfig, myCSS)
            const clip = await page.$eval('svg', svg => {
                const react = svg.getBoundingClientRect()
                return { x: react.left, y: react.top, width: react.width, height: react.height }
            })
            const outputPath = outputDir + '/' + f + count++ + '.png'
            await page.screenshot({ path: outputPath, clip, omitBackground: backgroundColor === 'transparent' })
            replacedMd = await replaceMarkdown(outputPath, replacedMd, match[0])
        }
        const distDir = input + '/dist'
        if(!fs.existsSync(distDir))
            fs.mkdirSync(distDir)
        fs.writeFileSync(distDir + '/' + f, replacedMd)
    }
    browser.close()
})()
