
set ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

git stash save --keep-index
git pull
rmdir /S /Q node_modules
rmdir /S /Q node_modules
npm install
npm install