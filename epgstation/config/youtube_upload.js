const fs = require('fs');
const spawn = require('child_process').spawn;

const input = process.env.INPUT;
const title = process.env.NAME; // 番組名
const description = process.env.DESCRIPTION; // 番組の概要
const extended = process.env.EXTENDED; // 番組の詳細

// youtube-uploadの設定
const uploadScript = '/usr/local/bin/upload_video_arg.sh';
const clientSecretsPath = '/home/node/client_secrets.json';
const credentialsFilePath = '/home/node/.youtube-upload-credentials.json';

let upload = true; // アップロードを必須に設定
let logEnabled = false; // ログファイル出力の有無
let playlistId; // プレイリストID

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
if (parsedArgs.upload) upload = parsedArgs.upload.toLowerCase() === 'true';
if (parsedArgs.logEnabled) logEnabled = parsedArgs.logEnabled.toLowerCase() === 'true';
if (parsedArgs.playlistId) playlistId = parsedArgs.playlistId;

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

log("===================== スクリプト実行開始 =====================");

// youtube-uploadの実行権限をログに出力
fs.stat(uploadScript, (err, stats) => {
    if (err) {
        log(`ファイル情報の取得に失敗しました: ${err}`);
        process.exit(1); // 実行権限のチェックで失敗した場合
    } else {
        log(`ファイル権限: ${stats.mode}`);
    }
});

if (upload) {
    // youtube-upload引数
    const uploadArgs = [
        '--client-secrets', clientSecretsPath,
        '--credentials-file', credentialsFilePath,
        '--title', title,
        '--description', extended ? `${description}\n${extended}` : description,
        '--privacy', 'unlisted',
        ...(playlistId ? ['--playlist', playlistId] : []),
        input
    ];

    // youtube-upload実行
    const uploadChild = spawn(uploadScript, uploadArgs);

    uploadChild.stdout.on('data', (data) => {
        const message = data.toString();
        log(`YouTubeアップロード出力: ${message}`);
        if (message.includes('Video URL:')) {
            log(`Video URL: ${message.match(/Video URL: (.+)/)[1]}`);
        }
    });

    uploadChild.stderr.on('data', (data) => {
        log(`YouTubeアップロードエラー: ${data.toString()}`);
    });

    uploadChild.on('close', (uploadCode) => {
        if (uploadCode === 0) {
            log('YouTubeアップロードが成功しました。');
            process.exit(0); // 成功として終了
        } else {
            log(`YouTubeアップロードに失敗しました: 終了コード ${uploadCode}`);
            process.exit(1); // 失敗として終了
        }
    });

    uploadChild.on('error', (err) => {
        log(`YouTubeアップロードエラー: ${err.toString()}`);
        process.exit(1); // プロセスエラーの場合も失敗として終了
    });
} else {
    log('ファイルのアップロードはスキップされました。');
    process.exit(0);
}
