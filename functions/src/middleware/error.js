import { StatusCodes } from 'http-status-codes';
import { logger } from 'firebase-functions';

// The 4th parameter is required: Express identifies error handlers by arity,
// so it must stay even though it is unused.
export const errorHandler = (err, req, res, _next) => {
    logger.error('Error:', err);

    // Joi validation errors
    if (err.isJoi) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            status: false,
            message: err.details.map(d => d.message).join(', ')
        });
    }

    // Firestore errors
    if (err.code && err.code.includes('firestore')) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Database error occurred'
        });
    }

    // Default error
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: err.message || 'Internal server error'
    });
};

export const notFoundHandler = (req, res) => {
    res.status(StatusCodes.NOT_FOUND).json({
        status: false,
        message: 'Route not found'
    });
};
