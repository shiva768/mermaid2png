#!/usr/bin/env node
const commander = require('commander')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
const a= fs.readFileSync('/tmp/xdata_profile.md', {encoding: "utf-8"})
console.log(a)
const reg = /.*```mermaid\n([\s\S]+?)\n```/gm
let match;
let matches = []
while ((match = reg.exec(a))!== null) {
    matches.push({original: match[0], target: match[1]});
}
console.log(matches)


const files = fs.readdirSync('/tmp');
const filterdFiles = files.filter((f) => f.endsWith('md')).map((f) => '/tmp/' + f)
console.log(filterdFiles)
