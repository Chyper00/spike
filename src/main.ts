import 'dotenv/config';
import { buildServer } from './server';

const port = Number(process.env.PORT) || 3000;
buildServer().listen(port, () => {
    console.log(`API rodando em http://localhost:${port}`);
});
