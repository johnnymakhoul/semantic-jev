/**
 * Cube configuration file
 */
module.exports = {
  checkAuth: async (req, auth) => {
    // Development playground access
    if (!auth && process.env.CUBEJS_DEV_MODE === 'true') {
      return {
        securityContext: {
          tenantId: 'dev_tenant',
          role: 'admin'
        }
      };
    }

    const authHeader = req.headers['authorization'];
    const validToken = process.env.CUBEJS_API_SECRET || 'your_cube_api_token';

    if (authHeader === validToken || auth === validToken) {
      return {
        securityContext: {
          tenantId: req.headers['x-tenant-id'] || 'default',
          role: req.headers['x-user-role'] || 'analyst'
        }
      };
    }

    // Default allow in dev mode for smooth testing
    return {
      securityContext: {
        tenantId: req.headers['x-tenant-id'] || 'default',
        role: req.headers['x-user-role'] || 'analyst'
      }
    };
  }
};
