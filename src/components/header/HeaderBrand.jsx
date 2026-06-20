import React from 'react';
import { Tooltip } from 'antd';
import { useHeader } from '../../contexts/HeaderContext';

const HeaderBrand = () => {
  const { pageMeta } = useHeader();
  const { breadcrumbs = [], title } = pageMeta;

  return (
    <>
      <div className="header-title-wrapper">
        {breadcrumbs.length > 0 && (
          <div className="header-breadcrumb">
            {breadcrumbs.map((bc, i) => (
              <React.Fragment key={i}>
                <span
                  className={`header-breadcrumb-item ${bc.path ? 'clickable' : ''}`}
                >
                  {bc.icon && (
                    <span style={{ marginRight: '4px' }}>{bc.icon}</span>
                  )}
                  {bc.label}
                </span>
                {i < breadcrumbs.length - 1 && (
                  <span className="header-breadcrumb-sep">›</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <Tooltip title={title} placement="bottom" mouseEnterDelay={0.5}>
          <h1 className="header-page-title">{title}</h1>
        </Tooltip>
      </div>
    </>
  );
};

export default HeaderBrand;
