#!/bin/sh

# 仮想環境を有効にする
. /opt/youtube-upload-env/bin/activate

# 固定のファイルパスを使用して youtube-upload コマンドを実行
youtube-upload --client-secrets=/home/node/client_secrets.json --credentials-file=/home/node/.youtube-upload-credentials.json --title="Test Video" --description="This is a test video" --privacy="unlisted" /tmp/test.mp4
