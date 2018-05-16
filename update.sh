#!/bin/bash

git stash save --keep-index
git pull
rm -rf node_modules
npm install
npm install