# ベースイメージとして l3tnun/epgstation を使用
FROM l3tnun/epgstation:master-debian

ENV DEV="make gcc git g++ automake curl wget autoconf build-essential libass-dev libfreetype6-dev libsdl1.2-dev libtheora-dev libtool libva-dev libvdpau-dev libvorbis-dev libxcb1-dev libxcb-shm0-dev libxcb-xfixes0-dev pkg-config texinfo zlib1g-dev cmake"
ENV FFMPEG_VERSION=7.0
ENV SVTAV1_VERSION=v1.0.0

# 必要なパッケージのインストール
RUN apt-get update && \
    apt-get -y install $DEV && \
    apt-get install -y apt-utils && \
    apt-get -y install yasm nasm libx264-dev libmp3lame-dev libopus-dev libvpx-dev && \
    apt-get -y install libx265-dev libnuma-dev && \
    apt-get -y install libasound2 libass9 libvdpau1 libva-x11-2 libva-drm2 libxcb-shm0 libxcb-xfixes0 libxcb-shape0 libvorbisenc2 libtheora0 libaribb24-dev && \
    apt-get -y install meson ninja-build && \
\
# SVT-AV1のビルドとインストール
    mkdir /tmp/svtav1_sources && \
    cd /tmp/svtav1_sources && \
    git clone --depth 1 --branch ${SVTAV1_VERSION} https://gitlab.com/AOMediaCodec/SVT-AV1.git && \
    cd SVT-AV1 && \
    mkdir build && cd build && \
    cmake .. -DCMAKE_INSTALL_PREFIX=/usr/local && \
    make -j$(nproc) && \
    make install && \
\
# ffmpegのビルド
    mkdir /tmp/ffmpeg_sources && \
    cd /tmp/ffmpeg_sources && \
    curl -fsSL http://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.bz2 | tar -xj --strip-components=1 && \
    ./configure \
      --prefix=/usr/local \
      --disable-shared \
      --pkg-config-flags=--static \
      --enable-gpl \
      --enable-libass \
      --enable-libfreetype \
      --enable-libmp3lame \
      --enable-libopus \
      --enable-libtheora \
      --enable-libvorbis \
      --enable-libvpx \
      --enable-libx264 \
      --enable-libx265 \
      --enable-libaribb24 \
      --enable-libsvtav1 \
      --enable-version3 \
      --enable-nonfree \
      --disable-debug \
      --disable-doc \
    && \
    make -j$(nproc) && \
    make install && \
\
# 不要なパッケージを削除
    apt-get -y remove $DEV && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

# youtube-uploadのインストール
RUN apt-get update && \
    apt-get -y install git python3-pip python3-venv && \
    # 仮想環境の作成
    python3 -m venv /opt/youtube-upload-env && \
    # 仮想環境を有効にし、パッケージをインストール
    . /opt/youtube-upload-env/bin/activate && \
    cd /tmp && \
    git clone https://github.com/tokland/youtube-upload.git && \
    cd youtube-upload && \
    pip install . && \
    rm -rf /tmp/*

# ローカルファイルをコンテナ内の /home/node にコピー
# パーミッションの設定
COPY user_conf/client_secrets.json /home/node/client_secrets.json
COPY user_conf/.youtube-upload-credentials.json /home/node/.youtube-upload-credentials.json
RUN chmod 644 /home/node/client_secrets.json
RUN chmod 644 /home/node/.youtube-upload-credentials.json

# ローカルファイルをコンテナ内の /usr/local/bin にコピー
# スクリプトに実行権限を付与
COPY user_conf/test.mp4 /tmp/.
COPY user_conf/test_upload.sh /tmp/
COPY user_conf/upload_video_arg.sh /usr/local/bin/
COPY user_conf/activate_youtube_upload.sh /usr/local/bin/
RUN chmod +x /tmp/test_upload.sh
RUN chmod +x /usr/local/bin/upload_video_arg.sh
RUN chmod +x /usr/local/bin/activate_youtube_upload.sh

# 仮想環境を有効にしてコマンドを実行するエントリーポイントスクリプト
COPY user_conf/entrypoint.sh /usr/local/bin/
#RUN chmod +x /usr/local/bin/entrypoint.sh

# youtube-uploadのアクティベートを実行
RUN /usr/local/bin/activate_youtube_upload.sh

# root所有でファイルが作成させるため、所有者をnodeに変更
RUN chown node /home/node/client_secrets.json
RUN chown node /home/node/.youtube-upload-credentials.json
