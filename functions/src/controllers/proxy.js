import { StatusCodes } from 'http-status-codes';
import requestIp from 'request-ip';

export const handleProxyRequest = async (req, res) => {
    try {

        const url = new URL(req.originalUrl, 'https://zimrate1.tyganeutronics.com');

        const clientIp = requestIp.getClientIp(req);

        const params = {
            headers: {
                ...req.headers,
                'X-Forwarded-For': clientIp || req.ip
            },
            method: req.method
        };

        if (req.method.toLowerCase() === 'post' && req.body) {
            params.body = JSON.stringify(req.body);
        }

        const response = await fetch(url.toString(), params);

        const data = await response.json();

        res.status(StatusCodes.OK).json(data);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};