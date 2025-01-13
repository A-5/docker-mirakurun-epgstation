const fs = require('fs');
const spawn = require('child_process').spawn;
const ffmpeg = process.env.FFMPEG;

const input = process.env.INPUT;
const output = process.env.OUTPUT;
const title = process.env.NAME; // 番組名
const description = process.env.DESCRIPTION; // 番組の概要
const extended = process.env.EXTENDED; // 番組の詳細

const analyzedurationSize = '10M'; // Mirakurun の設定に応じて変更すること
const probesizeSize = '32M'; // Mirakurun の設定に応じて変更すること
const maxMuxingQueueSize = 1024;
const dualMonoMode = 'main';
const videoHeight = parseInt(process.env.VIDEORESOLUTION, 10);
const isDualMono = parseInt(process.env.AUDIOCOMPONENTTYPE, 10) == 2;
const audioBitrate = videoHeight > 720 ? '192k' : '128k';

// youtube-uploadの設定
const uploadScript = '/usr/local/bin/upload_video_arg.sh';
const clientSecretsPath = '/home/node/client_secrets.json';
const credentialsFilePath = '/home/node/.youtube-upload-credentials.json';

let preset = 'veryfast';
let codec = 'libx264';
let crf = 24;
let upload = false; // YouTubeアップロードのデフォルトはしない設定
let logEnabled = false; // ログファイル出力の有無

// ログファイルのストリームを作成
const logFilePath = '/app/logs/Service/encode_debug.txt';
let logStream;
if (logEnabled) {
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
}

function log(message) {
    if (logEnabled) {
        logStream.write(`${new Date().toISOString()} - ${message}\n`);
    }
    console.log(message);
}

// 引数解析関数
function parseArgs(argv) {
    const args = {};
    argv.forEach(arg => {
        const [key, value] = arg.split('=');
        args[key] = value;
    });
    return args;
}

// 引数の解析
const parsedArgs = parseArgs(process.argv.slice(2));
if (parsedArgs.crf) crf = parsedArgs.crf;
if (parsedArgs.codec) codec = parsedArgs.codec;
if (parsedArgs.preset) preset = parsedArgs.preset;
if (parsedArgs.upload) upload = parsedArgs.upload.toLowerCase() === 'true';
if (parsedArgs.logEnabled) logEnabled = parsedArgs.logEnabled.toLowerCase() === 'true';
if (logEnabled) logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

log("===================== スクリプト実行開始 =====================");

// youtube-uploadの実行権限をログに出力
fs.stat(uploadScript, (err, stats) => {
    if (err) {
        log(`ファイル情報の取得に失敗しました: ${err}`);
    } else {
        log(`ファイル権限: ${stats.mode}`);
    }
});

const args = ['-y', '-analyzeduration', analyzedurationSize, '-probesize', probesizeSize];

// dual mono 設定
if (isDualMono) {
    Array.prototype.push.apply(args, ['-dual_mono_mode', dualMonoMode]);
}

// input 設定
Array.prototype.push.apply(args, ['-i', input]);

// メタ情報を先頭に置く
Array.prototype.push.apply(args, ['-movflags', 'faststart']);

// video filter 設定
let videoFilter = 'yadif';
if (videoHeight > 720) {
    videoFilter += ',scale=-2:720'
}
Array.prototype.push.apply(args, ['-vf', videoFilter]);

// その他設定
Array.prototype.push.apply(args, [
    '-preset', preset,
    '-aspect', '16:9',
    '-c:v', codec,
    '-crf', crf,
    '-f', 'mp4',
    '-c:a', 'aac',
    '-ar', '48000',
    '-ab', audioBitrate,
    '-ac', '2',
    output
]);

const child = spawn(ffmpeg, args);

child.stderr.on('data', (data) => {
    log(String(data));
});

child.on('error', (err) => {
    log(err.toString());
    throw new Error(err);
});

child.on('close', (code) => {
    if (code === 0) {
        if (upload) {
            // youtube-upload引数
            const uploadArgs = [
                '--client-secrets', `${clientSecretsPath}`,
                '--credentials-file', `${credentialsFilePath}`,
                '--title', `${title}`,
                '--description', extended ? `${description}\n${extended}` : `${description}`,
                '--privacy', 'unlisted',
                `${output}`
            ];

            // youtube-upload実行
            const uploadChild = spawn(uploadScript, uploadArgs);

            uploadChild.stdout.on('data', (data) => {
                log(`YouTubeアップロード出力: ${data.toString()}`);
            });

            uploadChild.stderr.on('data', (data) => {
                log(`YouTubeアップロードエラー: ${data.toString()}`);
            });

            uploadChild.on('close', (uploadCode) => {
                process.exitCode = code;
                if (uploadCode !== 0) {
                    log(`YouTubeアップロードに失敗しました: 終了コード ${uploadCode}`);
                }
            });

            uploadChild.on('error', (err) => {
                log(`YouTubeアップロードエラー: ${err.toString()}`);
                throw new Error(err);
            });
        } else {
            process.exitCode = code; // エンコード成功時の終了コードを設定
        }
    } else {
        log(`FFmpegエンコードに失敗しました: 終了コード ${code}`);
        process.exitCode = code;
    }
});

process.on('SIGINT', () => {
    child.kill('SIGINT');
});
