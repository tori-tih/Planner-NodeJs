// подключение express
const express = require("express");
const Eureka = require('eureka-js-client').Eureka;
// создаем объект приложения
const PORT = process.env.PORT || 3001;
const app = express();

// Название очереди
const QUEUE = 'message_queue';

// consumer.js
const amqp = require('amqplib');
let mes = '';

// Конфигурация
const config = {
    protocol: 'amqp',
    hostname: process.env.RABBIT_HOST || 'localhost',
    port: 5672,
    username: 'guest',
    password: 'guest',
    vhost: '/'
};

const client = new Eureka({
    // application instance information
    instance: {
        app: 'a-node-service',
        hostName:  process.env.HOST_NAME||'localhost',
        ipAddr: process.env.IP_ADDR||'127.0.0.1',
        statusPageUrl: 'http://localhost:3001',
        vipAddress: 'a-node-service',
        port: {
            $: PORT,
            '@enabled': 'true',
        },
        dataCenterInfo: {
            '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
            name: 'MyOwn',
        },
        registerWithEureka: true,
        fetchRegistry: true,
    },
    eureka: {
        // eureka server host / port
        host: process.env.EUREKA_HOST || 'localhost',
        port: process.env.EUREKA_PORT || 8761,
        servicePath: process.env.EUREKA_SERVICE_PATH || '/eureka/apps',
    },
});

// Функция для настройки и запуска consumer
async function setupConsumer() {
    try {
        // Создаем подключение к Rabbit
        const connection = await amqp.connect(config);
        console.log('Connected to RabbitMQ');

        // Создаем канал
        const channel = await connection.createChannel();
        console.log('Channel created');

        // Убеждаемся, что очередь существует
        await channel.assertQueue(QUEUE, {
            durable: true
        });

        console.log(' [*] Waiting for messages in %s. To exit press CTRL+C', QUEUE);

        // Устанавливаем префetch
        channel.prefetch(1);

        // Начинаем получать сообщения
        channel.consume(QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const content = JSON.parse(msg.content.toString());
                    console.log(" [x] Received message:", content);
                    mes+='/n';
                    mes+=content.toString();
                    // Здесь можно добавить обработку полученного сообщения
                    // Например:
                    await processMessage(content);

                    // Подтверждаем обработку сообщения
                    channel.ack(msg);
                } catch (error) {
                    console.error('Error processing message:', error);
                    // В случае ошибки возвращаем сообщение в очередь
                    channel.nack(msg);
                }
            }
        });

        // Обработка ошибок канала
        channel.on('error', (err) => {
            console.error('Channel error:', err);
        });

        // Обработка закрытия канала
        channel.on('close', () => {
            console.log('Channel closed');
        });

    } catch (error) {
        console.error('Error setting up consumer:', error);
        // Пробуем переподключиться через некоторое время
        setTimeout(setupConsumer, 5000);
    }
}

// Функция обработки сообщения
async function processMessage(content) {
    console.log('Processing message:', content);
}


// определяем обработчик для маршрута "/"
client.logger.level('debug');
client.start(error => {
    console.log(error || 'NodeJS Eureka Started!');

    app.get('/', (req, res) => {
        res.send(mes);
        res.end();
    });

    // Запускаем consumer
    setupConsumer().catch(error => {
        console.error('Failed to setup consumer:', error);
    });
});

// Запускаем Express сервер
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Обработка завершения работы приложения
process.on('SIGINT', async () => {
    try {
        await client.stop();
        process.exit();
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});