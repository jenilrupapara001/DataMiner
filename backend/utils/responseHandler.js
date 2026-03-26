/**
 * Unified Response Handler - Standardizes API Output
 * Mimics ASP.NET Core ActionResult/ObjectResult patterns for future migration.
 */
class ResponseHandler {
  
  /**
   * Success Response (200 OK / 201 Created)
   */
  success(res, data, message = 'Operation successful', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      timestamp: new Date().toISOString(),
      message,
      data
    });
  }

  /**
   * Error Response (4xx/5xx)
   */
  error(res, message = 'Internal Server Error', statusCode = 500, error = null) {
    const response = {
      success: false,
      timestamp: new Date().toISOString(),
      message,
      ...(process.env.NODE_ENV === 'development' && error ? { details: error.message || error } : {})
    };
    
    return res.status(statusCode).json(response);
  }
}

module.exports = new ResponseHandler();
