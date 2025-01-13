#!/bin/sh

# 仮想環境を有効にする
. /opt/youtube-upload-env/bin/activate

# ダミーファイルを作成
dummy_video=/tmp/dummy_video.mp4
touch $dummy_video

youtube-upload --client-secrets=/home/node/client_secrets.json --credentials-file=/home/node/.youtube-upload-credentials.json --title="Activation" --description="Activation for youtube-upload" --privacy="private" $dummy_video || true

# ダミーファイルを削除
rm $dummy_video
