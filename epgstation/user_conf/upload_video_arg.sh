#!/bin/sh

# 仮想環境を有効にする
. /opt/youtube-upload-env/bin/activate

# 引数のチェック
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <upload-arguments>"
    exit 1
fi

# youtube-upload コマンドの実行
youtube-upload "$@"
